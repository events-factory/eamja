// Shared types and helpers for the registration-update page. It talks to
// SmartEvent through this app's own /api/smartevent proxy, which adds the
// event code server-side.

export const SMARTEVENT_API = '/api/smartevent';

export interface FormInputOption {
  id: number;
  contentEnglish: string;
  contentFrench: string;
}

export interface FormInput {
  inputcode: string;
  nameEnglish: string;
  nameFrench: string;
  is_mandatory: 'YES' | 'NO';
  allow_other: 'YES' | 'NO';
  inputtype: { id: number; name: string };
}

// Display-Categories-Form-Inputs and Registration-Form-Data-Retriever both
// return the form in this shape; the retriever also fills `value` with what
// the delegate saved.
export interface FormInputGroup {
  group: { id: number; name: string; nameFrench: string };
  inputs: Array<{
    input: FormInput;
    options: FormInputOption[];
    value: string | null;
  }>;
}

export interface FormValues {
  // A newly chosen image is a base64 data URL, sent like any other answer.
  [key: string]: string | string[];
}

// SmartEvent uses stable input codes for the three fields it also wants as
// top-level columns on the registration.
export const EMAIL_INPUT = 'input_id_52307';
export const FIRST_NAME_INPUT = 'input_id_21576';
export const LAST_NAME_INPUT = 'input_id_35129';

// Checkbox groups are stored as one comma-joined string.
const CHECKBOX_TYPE = 16;
// An "image" input in SmartEvent, shown as a profile-photo picker.
export const IMAGE_TYPE = 7;

export function decodeHtml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

// SmartEvent reports failures as `message`, either a string or a list.
export function messageList(
  message: string | string[] | undefined,
  fallback: string,
): string[] {
  if (Array.isArray(message) && message.length > 0) return message;
  if (typeof message === 'string' && message) return [message];
  return [fallback];
}

// SmartEvent saves a registration even when it cannot send the confirmation
// email, and says so in `message` ("…but no email have been sent…"). The
// success screen checks this instead of promising an email.
export function confirmationEmailSent(
  message: string | string[] | undefined,
): boolean {
  const text = Array.isArray(message) ? message.join(' ') : message || '';
  return !/no email/i.test(text);
}

// `ok` carries the HTTP status: SmartEvent rejects a request with a 400 and
// just `{ message: [...] }`, without `success: false`.
export async function smartEventPost<T>(
  endpoint: string,
  formData: FormData,
): Promise<T & { ok: boolean }> {
  const res = await fetch(`${SMARTEVENT_API}${endpoint}`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  return { ...data, ok: res.ok };
}

export async function smartEventJson<T>(
  endpoint: string,
  body: object,
): Promise<T & { ok: boolean }> {
  const formData = new FormData();
  Object.entries(body).forEach(([k, v]) => formData.append(k, String(v)));
  return smartEventPost<T>(endpoint, formData);
}

// Seeds the form from the values the retriever returns. Checkbox groups come
// back joined, the way buildDelegateForm sent them.
export function valuesFromGroups(groups: FormInputGroup[]): FormValues {
  const values: FormValues = {};
  groups.forEach((group) => {
    group.inputs.forEach(({ input, value }) => {
      if (value == null || value === '') return;
      values[input.inputcode] =
        input.inputtype.id === CHECKBOX_TYPE
          ? String(value)
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean)
          : String(value);
    });
  });
  return values;
}

// The fields Register-Delegate and Update-Delegate share: the delegate's
// answers as `delegate_data`, plus name and email as top-level columns.
// `blank` lists inputs to send empty rather than leave out, so an update
// clears an answer saved earlier.
export function buildDelegateForm(
  groups: FormInputGroup[],
  values: FormValues,
  blank: string[] = [],
): FormData {
  const delegateData: Array<{
    input_code: string;
    input_type: string;
    input_value: string;
    input_name: string;
  }> = [];
  const form = new FormData();

  groups.forEach((group) => {
    group.inputs.forEach(({ input }) => {
      const value = values[input.inputcode];
      if (!value || (Array.isArray(value) && value.length === 0)) {
        if (blank.includes(input.inputcode)) {
          delegateData.push({
            input_code: input.inputcode,
            input_type: String(input.inputtype.id),
            input_value: '',
            input_name: input.nameEnglish,
          });
        }
        return;
      }
      const valueStr = Array.isArray(value) ? value.join(', ') : value;
      delegateData.push({
        input_code: input.inputcode,
        input_type: String(input.inputtype.id),
        input_value: valueStr,
        input_name: input.nameEnglish,
      });
      if (input.inputcode === EMAIL_INPUT)
        form.append('registration_email', valueStr);
      if (input.inputcode === FIRST_NAME_INPUT)
        form.append('first_name', valueStr);
      if (input.inputcode === LAST_NAME_INPUT)
        form.append('last_name', valueStr);
    });
  });

  form.append('delegate_data', JSON.stringify(delegateData));
  form.append('user_language', 'english');
  return form;
}
