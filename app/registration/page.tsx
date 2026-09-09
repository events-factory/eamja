'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import PaymentModal from '@/components/PaymentModal';
import SearchableSelect from '@/components/SearchableSelect';
import {
  initializePayment,
  processPayment,
  requiresPayment,
  parseFeeAmount,
  extractCurrency,
  PaymentResult,
  PaymentSession,
} from '@/lib/payment';

const SMARTEVENT_API = '/api/smartevent';

// A plain <select> gets unwieldy past this many options (country lists, for
// example), so those switch to the searchable variant.
const SEARCHABLE_THRESHOLD = 12;

function decodeHtml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

interface RegistrationCategory {
  id: number;
  name_english: string;
  name_french: string;
  fee: string;
  normal_fee?: string;
  early_payment_date: string;
  end_date: string;
}

interface FormInputOption {
  id: number;
  contentEnglish: string;
  contentFrench: string;
}

interface FormInput {
  inputcode: string;
  nameEnglish: string;
  nameFrench: string;
  is_mandatory: 'YES' | 'NO';
  allow_other: 'YES' | 'NO';
  inputtype: { id: number; name: string };
}

interface FormInputGroup {
  group: { id: number; name: string; nameFrench: string };
  inputs: Array<{
    input: FormInput;
    options: FormInputOption[];
    value: string;
  }>;
}

interface FormValues {
  [key: string]: string | string[];
}

// SmartEvent uses stable input codes for the three fields it also wants as
// top-level columns on the registration.
const EMAIL_INPUT = 'input_id_52307';
const FIRST_NAME_INPUT = 'input_id_21576';
const LAST_NAME_INPUT = 'input_id_35129';

async function smartEventPost<T>(
  endpoint: string,
  formData: FormData,
): Promise<T> {
  const res = await fetch(`${SMARTEVENT_API}${endpoint}`, {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

async function smartEventJson<T>(endpoint: string, body: object): Promise<T> {
  const formData = new FormData();
  Object.entries(body).forEach(([k, v]) => formData.append(k, String(v)));
  const res = await fetch(`${SMARTEVENT_API}${endpoint}`, {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

export default function RegistrationPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [eventType, setEventType] = useState<
    'HYBRID' | 'PHYSICAL' | 'VIRTUAL' | null
  >(null);
  const [attendanceType, setAttendanceType] = useState<
    'PHYSICAL' | 'VIRTUAL' | null
  >(null);
  const [categories, setCategories] = useState<RegistrationCategory[]>([]);
  const [selectedCategory, setSelectedCategory] =
    useState<RegistrationCategory | null>(null);
  const [formGroups, setFormGroups] = useState<FormInputGroup[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [formValues, setFormValues] = useState<FormValues>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [badgeId, setBadgeId] = useState('');
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [paymentRequired, setPaymentRequired] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(
    null,
  );
  const [paymentData, setPaymentData] = useState({
    orderId: '',
    transactionId: '',
  });

  const loadCategories = useCallback(async (type: 'PHYSICAL' | 'VIRTUAL') => {
    setLoading(true);
    try {
      const data = await smartEventJson<{ data: RegistrationCategory[] }>(
        '/Display-Registration-Categories',
        { attendence: type, operation: 'get-categories' },
      );
      setCategories(data.data || []);
    } catch {
      setError('Failed to load registration categories. Please try again.');
    }
    setLoading(false);
  }, []);

  // A non-hybrid event has only one possible attendance type, so its
  // categories are fetched straight away and the chooser is skipped.
  const loadRegistrationPage = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${SMARTEVENT_API}/Registration-Page-Api`);
      const data = await res.json();
      const type: 'HYBRID' | 'PHYSICAL' | 'VIRTUAL' =
        data?.event_description?.event_type || 'PHYSICAL';
      setEventType(type);
      if (type !== 'HYBRID') {
        setAttendanceType(type);
        await loadCategories(type);
        return;
      }
    } catch {
      setError('Failed to load the registration page. Please try again.');
    }
    setLoading(false);
  }, [loadCategories]);

  useEffect(() => {
    // Mount-time fetch of the event's registration settings. The lint rule
    // flags the loading/error reset this performs before awaiting, which is
    // exactly what a fetch-on-mount needs to do.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRegistrationPage();
  }, [loadRegistrationPage]);

  async function selectAttendance(type: 'PHYSICAL' | 'VIRTUAL') {
    setAttendanceType(type);
    await loadCategories(type);
  }

  async function selectCategory(category: RegistrationCategory) {
    setSelectedCategory(category);
    setLoading(true);
    const needsPayment = requiresPayment(category.fee);
    setPaymentRequired(needsPayment);
    if (needsPayment) {
      setPaymentData((prev) => ({
        ...prev,
        orderId: `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      }));
    }
    try {
      const data = await smartEventJson<{ data: FormInputGroup[] }>(
        '/Display-Categories-Form-Inputs',
        {
          category: category.id,
          attendence: attendanceType!,
          operation: 'get-form-inputs',
        },
      );
      setFormGroups(data.data || []);
      setCurrentStep(0);
      setFormValues({});
    } catch {
      setError('Failed to load the registration form. Please try again.');
    }
    setLoading(false);
  }

  const validateStep = useCallback(() => {
    const currentGroup = formGroups[currentStep];
    if (!currentGroup) return true;

    const errors: string[] = [];
    const fieldErrs: Record<string, string> = {};

    currentGroup.inputs.forEach(({ input }) => {
      const value = formValues[input.inputcode];
      const isEmpty =
        !value ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === 'string' && value.trim() === '');

      if (input.is_mandatory === 'YES' && isEmpty) {
        const msg = `${input.nameEnglish} is required`;
        errors.push(msg);
        fieldErrs[input.inputcode] = msg;
        return;
      }

      if (!isEmpty && typeof value === 'string') {
        if (input.inputtype.id === 5) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            const msg = `${input.nameEnglish} must be a valid email address`;
            errors.push(msg);
            fieldErrs[input.inputcode] = msg;
          }
        }
        if (input.inputtype.id === 12) {
          if (
            !/^[\d\s+()-]+$/.test(value) ||
            value.replace(/\D/g, '').length < 7
          ) {
            const msg = `${input.nameEnglish} must be a valid phone number`;
            errors.push(msg);
            fieldErrs[input.inputcode] = msg;
          }
        }
      }
    });

    setFormErrors(errors);
    setFieldErrors(fieldErrs);

    if (errors.length > 0) {
      document
        .querySelector('form')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    return errors.length === 0;
  }, [currentStep, formGroups, formValues]);

  function handleInputChange(inputCode: string, value: string | string[]) {
    setFormValues((prev) => ({ ...prev, [inputCode]: value }));
    if (fieldErrors[inputCode]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[inputCode];
        return next;
      });
    }
  }

  function nextStep() {
    if (validateStep()) {
      setFormErrors([]);
      setFieldErrors({});
      setCurrentStep((prev) => Math.min(prev + 1, formGroups.length - 1));
    }
  }

  function prevStep() {
    setFormErrors([]);
    setFieldErrors({});
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }

  // Persists the registration to SmartEvent. Called after a card payment
  // succeeds, or directly for bank-transfer and free categories. `payment`
  // carries whatever reference the gateway produced.
  async function finalizeRegistration(payment: {
    orderId?: string;
    paymentToken?: string;
    paymentSession?: string;
    transactionId?: string;
  }) {
    if (!selectedCategory) return;
    setSubmitting(true);
    try {
      const delegateData: Array<{
        input_code: string;
        input_type: string;
        input_value: string;
        input_name: string;
      }> = [];
      const submitForm = new FormData();

      formGroups.forEach((group) => {
        group.inputs.forEach(({ input }) => {
          const value = formValues[input.inputcode];
          if (value) {
            const valueStr = Array.isArray(value) ? value.join(', ') : value;
            delegateData.push({
              input_code: input.inputcode,
              input_type: String(input.inputtype.id),
              input_value: valueStr,
              input_name: input.nameEnglish,
            });
            if (input.inputcode === EMAIL_INPUT)
              submitForm.append('registration_email', valueStr);
            if (input.inputcode === FIRST_NAME_INPUT)
              submitForm.append('first_name', valueStr);
            if (input.inputcode === LAST_NAME_INPUT)
              submitForm.append('last_name', valueStr);
          }
        });
      });

      submitForm.append('delegate_data', JSON.stringify(delegateData));
      submitForm.append('ticket_id', String(selectedCategory.id));
      submitForm.append('attendence_type', attendanceType || 'PHYSICAL');
      submitForm.append('user_language', 'english');
      submitForm.append('accompanied', 'NO');
      submitForm.append('registration_type', 'single');
      submitForm.append(
        'grand_total',
        String(parseFeeAmount(selectedCategory.fee)),
      );

      submitForm.append('order_id', payment.orderId || '');
      submitForm.append('payment_token', payment.paymentToken || '');
      submitForm.append('payment_session', payment.paymentSession || '');
      submitForm.append('acknowleadgment', payment.transactionId || '');

      const result = await smartEventPost<{
        success?: boolean;
        message?: string | string[];
        registration_number?: string | number;
      }>('/Register-Delegate', submitForm);

      if (result.success !== false) {
        if (
          result.registration_number != null &&
          result.registration_number !== ''
        ) {
          setBadgeId(String(result.registration_number));
        }
        setPaymentData((prev) => ({
          ...prev,
          transactionId: payment.transactionId || '',
        }));
        setSubmitted(true);
      } else {
        const msg = Array.isArray(result.message)
          ? result.message
          : [result.message || 'Registration failed. Please try again.'];
        setFormErrors(msg);
      }
    } catch {
      setFormErrors([
        'Something went wrong while submitting your registration. Please try again.',
      ]);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateStep()) return;
    if (!selectedCategory) {
      setFormErrors(['Please select a category']);
      return;
    }

    setFormErrors([]);

    const isBankTransfer = Object.values(formValues).some(
      (v) => typeof v === 'string' && v.toLowerCase().includes('bank transfer'),
    );

    // Bank transfer and free categories save straight away; everything else
    // goes through the card gateway first.
    if (!paymentRequired || isBankTransfer) {
      await finalizeRegistration({});
      return;
    }

    setSubmitting(true);
    try {
      setProcessingPayment(true);
      const customerEmail = (formValues[EMAIL_INPUT] as string) || '';
      const firstName = (formValues[FIRST_NAME_INPUT] as string) || '';
      const lastName = (formValues[LAST_NAME_INPUT] as string) || '';

      if (!customerEmail) {
        setFormErrors(['Email is required for payment processing']);
        setSubmitting(false);
        setProcessingPayment(false);
        return;
      }

      const totalAmount = parseFeeAmount(selectedCategory.fee);
      const currency = extractCurrency(selectedCategory.fee);

      const session = await initializePayment({
        orderId: paymentData.orderId,
        amount: totalAmount,
        currency,
        categoryName: decodeHtml(selectedCategory.name_english),
        categoryId: selectedCategory.id,
        attendenceType: attendanceType || 'PHYSICAL',
        customerEmail,
        customerName: `${firstName} ${lastName}`.trim(),
      });

      if (!session) {
        setFormErrors(['Failed to initialize payment. Please try again.']);
        setSubmitting(false);
        setProcessingPayment(false);
        return;
      }

      setPaymentSession(session);
      setShowPaymentModal(true);
      setProcessingPayment(false);

      const paymentResult: PaymentResult = await processPayment(session);

      setShowPaymentModal(false);

      if (!paymentResult.success) {
        setFormErrors([
          paymentResult.error || 'Payment was not completed. Please try again.',
        ]);
        setSubmitting(false);
        return;
      }

      await finalizeRegistration({
        orderId: paymentResult.orderId,
        paymentToken: paymentResult.paymentToken || '',
        paymentSession: paymentResult.paymentSession || '',
        transactionId: paymentResult.transactionId || '',
      });
    } catch {
      setFormErrors(['Failed to process payment. Please try again.']);
      setSubmitting(false);
      setProcessingPayment(false);
    }
  }

  function renderInput(
    input: FormInput,
    options: FormInputOption[],
    value: string,
  ) {
    const inputValue = formValues[input.inputcode] ?? value ?? '';
    const isRequired = input.is_mandatory === 'YES';
    const hasError = !!fieldErrors[input.inputcode];
    const base =
      'w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:outline-none';
    const errorClass = hasError
      ? 'border-red-500 focus:ring-red-400'
      : 'border-gray-300 focus:ring-primary-500/30 focus:border-primary-500';

    const errorText = hasError ? (
      <p className="mt-1 text-sm text-red-600">{fieldErrors[input.inputcode]}</p>
    ) : null;

    switch (input.inputtype.id) {
      case 2:
        if (options.length > SEARCHABLE_THRESHOLD) {
          return (
            <>
              <SearchableSelect
                id={input.inputcode}
                options={options.map((opt) => ({
                  value: opt.contentEnglish,
                  label: opt.contentEnglish,
                }))}
                value={inputValue as string}
                onChange={(v) => handleInputChange(input.inputcode, v)}
                hasError={hasError}
              />
              {errorText}
            </>
          );
        }
        return (
          <>
            <select
              id={input.inputcode}
              value={inputValue as string}
              onChange={(e) =>
                handleInputChange(input.inputcode, e.target.value)
              }
              className={`${base} ${errorClass} bg-white appearance-none pr-10 cursor-pointer`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B7A85' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
                backgroundSize: '1.1rem',
              }}
              required={isRequired}
            >
              <option value="">Select an option</option>
              {options.map((opt) => (
                <option key={opt.id} value={opt.contentEnglish}>
                  {opt.contentEnglish}
                </option>
              ))}
            </select>
            {errorText}
          </>
        );
      case 4:
        return (
          <>
            <input
              type="date"
              id={input.inputcode}
              value={inputValue as string}
              onChange={(e) =>
                handleInputChange(input.inputcode, e.target.value)
              }
              className={`${base} ${errorClass}`}
              required={isRequired}
            />
            {errorText}
          </>
        );
      case 5:
        return (
          <>
            <input
              type="email"
              id={input.inputcode}
              value={inputValue as string}
              onChange={(e) =>
                handleInputChange(input.inputcode, e.target.value)
              }
              className={`${base} ${errorClass}`}
              required={isRequired}
            />
            {errorText}
          </>
        );
      case 8:
        return (
          <>
            <input
              type="number"
              id={input.inputcode}
              value={inputValue as string}
              onChange={(e) =>
                handleInputChange(input.inputcode, e.target.value)
              }
              className={`${base} ${errorClass}`}
              required={isRequired}
            />
            {errorText}
          </>
        );
      case 10:
        return (
          <>
            <div
              className={
                hasError ? 'p-2 border-2 border-red-500 rounded-lg' : ''
              }
            >
              <div className="flex flex-wrap gap-2">
                {options.map((opt) => {
                  const selected = inputValue === opt.contentEnglish;
                  return (
                    <label
                      key={opt.id}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm cursor-pointer transition-colors"
                      style={{
                        borderColor: selected ? 'var(--red)' : '#d1d5db',
                        background: selected
                          ? 'rgba(198,27,17,0.06)'
                          : '#fff',
                        color: selected ? 'var(--red)' : 'var(--text)',
                        fontWeight: selected ? 600 : 400,
                      }}
                    >
                      <input
                        type="radio"
                        name={input.inputcode}
                        value={opt.contentEnglish}
                        checked={selected}
                        onChange={(e) =>
                          handleInputChange(input.inputcode, e.target.value)
                        }
                        className="w-4 h-4 accent-primary-500"
                        required={isRequired}
                      />
                      <span>{opt.contentEnglish}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            {errorText}
          </>
        );
      case 12:
        return (
          <>
            <input
              type="tel"
              id={input.inputcode}
              value={inputValue as string}
              onChange={(e) =>
                handleInputChange(input.inputcode, e.target.value)
              }
              className={`${base} ${errorClass}`}
              required={isRequired}
            />
            {errorText}
          </>
        );
      case 15:
        return (
          <>
            <textarea
              id={input.inputcode}
              value={inputValue as string}
              onChange={(e) =>
                handleInputChange(input.inputcode, e.target.value)
              }
              rows={4}
              className={`${base} ${errorClass}`}
              required={isRequired}
            />
            {errorText}
          </>
        );
      case 16:
        return (
          <>
            <div
              className={
                hasError
                  ? 'p-3 border-2 border-red-500 rounded-lg space-y-2'
                  : 'space-y-2'
              }
            >
              {options.map((opt) => (
                <label key={opt.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    value={opt.contentEnglish}
                    checked={
                      Array.isArray(inputValue)
                        ? inputValue.includes(opt.contentEnglish)
                        : inputValue === opt.contentEnglish
                    }
                    onChange={(e) => {
                      const current = Array.isArray(inputValue)
                        ? inputValue
                        : inputValue
                          ? [inputValue as string]
                          : [];
                      handleInputChange(
                        input.inputcode,
                        e.target.checked
                          ? [...current, e.target.value]
                          : current.filter((v) => v !== e.target.value),
                      );
                    }}
                    className="w-4 h-4 accent-primary-500"
                  />
                  <span>{opt.contentEnglish}</span>
                </label>
              ))}
            </div>
            {errorText}
          </>
        );
      case 17:
        return (
          <p
            className="p-4 rounded-lg"
            style={{ background: 'var(--light)', color: 'var(--muted)' }}
          >
            {input.nameEnglish}
          </p>
        );
      default:
        return (
          <>
            <input
              type="text"
              id={input.inputcode}
              value={inputValue as string}
              onChange={(e) =>
                handleInputChange(input.inputcode, e.target.value)
              }
              className={`${base} ${errorClass}`}
              required={isRequired}
            />
            {errorText}
          </>
        );
    }
  }

  const header = (
    <div
      style={{
        background: 'linear-gradient(135deg, var(--ink) 0%, var(--red2) 100%)',
        padding: '48px 24px 56px',
      }}
    >
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <div className="flex items-center gap-4 mb-8">
          <span className="bg-white rounded-full p-1 shrink-0 shadow-lg">
            <Image
              src="/eamja-logo.png"
              alt="EAMJA"
              width={56}
              height={56}
              priority
              className="rounded-full"
            />
          </span>
          <span
            className="text-white font-semibold leading-tight"
            style={{ fontFamily: 'var(--font-poppins),sans-serif' }}
          >
            EAMJA
            <span
              className="block text-xs font-normal"
              style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              East African Magistrates&apos; and Judges&apos; Association
            </span>
          </span>
        </div>
        <p
          style={{
            fontFamily: 'var(--font-poppins),sans-serif',
            fontSize: 11,
            letterSpacing: 3,
            textTransform: 'uppercase',
            color: 'var(--sky)',
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          Conference Registration
        </p>
        <h1
          style={{
            fontFamily: 'var(--font-poppins),sans-serif',
            fontSize: 'clamp(28px,4vw,44px)',
            fontWeight: 800,
            color: 'var(--white)',
            lineHeight: 1.2,
            maxWidth: 700,
          }}
        >
          Register to attend
        </h1>
        <p
          style={{
            color: 'rgba(255,255,255,0.75)',
            marginTop: 12,
            fontSize: 16,
            maxWidth: 600,
          }}
        >
          Choose your delegate category, complete your details and confirm your
          place.
        </p>
      </div>
    </div>
  );

  if (submitted) {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ background: 'var(--light)' }}
      >
        {header}
        <div className="flex-1 flex items-start justify-center px-4 py-12">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-lg w-full">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-10 h-10 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2
              className="text-2xl font-bold mb-4"
              style={{
                color: 'var(--ink)',
                fontFamily: 'var(--font-poppins),sans-serif',
              }}
            >
              {paymentData.transactionId
                ? 'Payment received — you are registered'
                : 'Registration complete'}
            </h2>
            <p className="mb-6" style={{ color: 'var(--muted)' }}>
              Thank you for registering. A confirmation email with your details
              is on its way.
            </p>
            {badgeId && (
              <div
                className="mb-6 p-4 rounded-lg border"
                style={{
                  background: 'rgba(91,185,210,0.1)',
                  borderColor: 'rgba(91,185,210,0.4)',
                }}
              >
                <p
                  className="text-xs uppercase tracking-wide font-semibold"
                  style={{ color: 'var(--sky2)' }}
                >
                  Registration number
                </p>
                <p
                  className="text-2xl font-bold font-mono mt-1"
                  style={{ color: 'var(--ink)' }}
                >
                  {badgeId}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                  Keep this for check-in.
                </p>
              </div>
            )}
            {paymentData.transactionId && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-left">
                <h3 className="text-sm font-semibold text-green-800 mb-3">
                  Payment details
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span style={{ color: 'var(--muted)' }}>
                      Transaction ID
                    </span>
                    <span className="font-mono font-medium truncate">
                      {paymentData.transactionId}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span style={{ color: 'var(--muted)' }}>Order ID</span>
                    <span className="font-mono font-medium truncate">
                      {paymentData.orderId}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span style={{ color: 'var(--muted)' }}>Status</span>
                    <span className="text-green-600 font-medium">Paid</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--light)' }}
    >
      {header}

      <div
        className="flex-1"
        style={{
          maxWidth: 1160,
          margin: '0 auto',
          width: '100%',
          padding: '40px 24px 64px',
        }}
      >
        {loading ? (
          <div className="bg-white rounded-xl shadow p-8 text-center">
            <div
              className="animate-spin w-12 h-12 border-4 rounded-full mx-auto mb-4"
              style={{
                borderColor: 'var(--red)',
                borderTopColor: 'transparent',
              }}
            />
            <p style={{ color: 'var(--muted)' }}>Loading…</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl shadow p-8 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={loadRegistrationPage}
              className="px-6 py-2 rounded-lg text-white font-semibold"
              style={{ background: 'var(--red)' }}
            >
              Try again
            </button>
          </div>
        ) : eventType === 'HYBRID' && !attendanceType ? (
          /* Attendance type */
          <div className="bg-white rounded-xl shadow p-8">
            <h2
              className="text-xl font-semibold text-center mb-6"
              style={{
                fontFamily: 'var(--font-poppins),sans-serif',
                color: 'var(--ink)',
              }}
            >
              How will you attend?
            </h2>
            <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              {(['PHYSICAL', 'VIRTUAL'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => selectAttendance(type)}
                  className="p-6 border-2 rounded-xl hover:shadow-lg transition-all text-center"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'rgba(198,27,17,0.08)' }}
                  >
                    <svg
                      className="w-8 h-8"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      style={{ color: 'var(--red)' }}
                    >
                      {type === 'PHYSICAL' ? (
                        <>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </>
                      ) : (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      )}
                    </svg>
                  </div>
                  <h3
                    className="text-lg font-semibold mb-1"
                    style={{
                      color: 'var(--ink)',
                      fontFamily: 'var(--font-poppins),sans-serif',
                    }}
                  >
                    {type === 'PHYSICAL' ? 'In person' : 'Virtual'}
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    {type === 'PHYSICAL'
                      ? 'Join us at the venue'
                      : 'Attend online from anywhere'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : !selectedCategory ? (
          /* Category selection */
          <div className="bg-white rounded-xl shadow p-8">
            <div className="flex items-center justify-between mb-4 gap-4">
              <h2
                className="text-xl font-semibold"
                style={{
                  fontFamily: 'var(--font-poppins),sans-serif',
                  color: 'var(--ink)',
                }}
              >
                Select your category
              </h2>
              {eventType === 'HYBRID' && (
                <button
                  onClick={() => setAttendanceType(null)}
                  className="text-sm"
                  style={{ color: 'var(--sky2)' }}
                >
                  Change attendance
                </button>
              )}
            </div>
            {categories.length === 0 ? (
              <p className="text-center py-8" style={{ color: 'var(--muted)' }}>
                No registration categories are open at the moment.
              </p>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.map((category) => {
                  const isFree = !requiresPayment(category.fee);
                  const discountedFrom =
                    !isFree &&
                    category.normal_fee &&
                    parseFeeAmount(category.normal_fee) >
                      parseFeeAmount(category.fee)
                      ? category.normal_fee
                      : null;
                  return (
                    <div
                      key={category.id}
                      className="border-2 rounded-xl p-6 hover:shadow-lg transition-all relative overflow-hidden flex flex-col h-full"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      {isFree && (
                        <div
                          className="absolute top-0 right-0 text-white text-xs font-bold px-3 py-1 rounded-bl-lg"
                          style={{ background: '#16a34a' }}
                        >
                          FREE
                        </div>
                      )}
                      <h3
                        className="text-lg font-semibold mb-2 min-h-14 pr-12"
                        style={{
                          color: 'var(--ink)',
                          fontFamily: 'var(--font-poppins),sans-serif',
                        }}
                      >
                        {decodeHtml(category.name_english)}
                      </h3>
                      <p
                        className="text-2xl font-bold mb-3 flex items-baseline gap-2 flex-wrap"
                        style={{ color: isFree ? '#16a34a' : 'var(--red)' }}
                      >
                        <span>{category.fee}</span>
                        {discountedFrom && (
                          <span
                            className="text-base font-semibold line-through"
                            style={{ color: 'var(--muted)' }}
                          >
                            {discountedFrom}
                          </span>
                        )}
                      </p>
                      <p
                        className="text-sm font-bold mb-5 inline-block px-3 py-1.5 rounded-md self-start"
                        style={
                          category.early_payment_date
                            ? {
                                color: '#b45309',
                                background: 'rgba(180,83,9,0.1)',
                              }
                            : {
                                color: 'var(--sky2)',
                                background: 'rgba(91,185,210,0.12)',
                              }
                        }
                      >
                        {category.early_payment_date
                          ? `Early bird ends ${category.early_payment_date}`
                          : `Registration closes ${category.end_date}`}
                      </p>
                      <button
                        onClick={() => selectCategory(category)}
                        className="w-full py-2 rounded-lg text-white font-semibold transition-colors mt-auto"
                        style={{
                          background: isFree ? '#16a34a' : 'var(--red)',
                        }}
                      >
                        Register
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Registration form */
          <div className="bg-white rounded-xl shadow overflow-hidden">
            {formGroups.length > 1 && (
              <div
                className="px-6 py-4 border-b flex gap-2 overflow-x-auto"
                style={{
                  background: 'var(--light)',
                  borderColor: 'var(--border)',
                }}
              >
                {formGroups.map((group, index) => (
                  <button
                    key={group.group.id}
                    onClick={() => {
                      if (index < currentStep) setCurrentStep(index);
                    }}
                    className="flex-1 text-center px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
                    style={{
                      background:
                        index === currentStep
                          ? 'var(--red)'
                          : index < currentStep
                            ? 'rgba(198,27,17,0.12)'
                            : '#e5e7eb',
                      color:
                        index === currentStep
                          ? 'var(--white)'
                          : index < currentStep
                            ? 'var(--red)'
                            : '#6b7280',
                    }}
                  >
                    {group.group.name}
                  </button>
                ))}
              </div>
            )}

            {/* noValidate: validateStep() owns validation so every field's
                error is reported at once, in the same styled banner the
                multi-step "Next" button uses, rather than the browser
                surfacing them one native bubble at a time. */}
            <form onSubmit={handleSubmit} className="p-6" noValidate>
              {formErrors.length > 0 && (
                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div>
                      <h3 className="text-sm font-semibold text-red-800 mb-2">
                        Please fix the following
                      </h3>
                      <ul className="list-disc list-inside text-red-700 text-sm space-y-1">
                        {formErrors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {formGroups[currentStep] &&
                (() => {
                  const group = formGroups[currentStep];
                  // A lone column field reads better spanning the full width.
                  const singleColumn =
                    group.inputs.filter(
                      (it) => ![10, 15, 16, 17].includes(it.input.inputtype.id),
                    ).length === 1;
                  return (
                    <div className="space-y-5">
                      <h3
                        className="text-lg font-semibold"
                        style={{
                          color: 'var(--ink)',
                          fontFamily: 'var(--font-poppins),sans-serif',
                        }}
                      >
                        {group.group.name}
                      </h3>
                      <div
                        className="rounded-xl border bg-white p-4 sm:p-5"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                          {group.inputs.map(({ input, options, value }) => {
                            const fullWidth =
                              singleColumn ||
                              [10, 15, 16, 17].includes(input.inputtype.id);
                            return (
                              <div
                                key={input.inputcode}
                                className={fullWidth ? 'sm:col-span-2' : ''}
                              >
                                {input.inputtype.id !== 17 && (
                                  <label
                                    htmlFor={input.inputcode}
                                    className="block text-sm font-medium mb-1.5"
                                    style={{ color: 'var(--text)' }}
                                  >
                                    {input.nameEnglish}
                                    {input.is_mandatory === 'YES' && (
                                      <span className="text-red-500 ml-1">
                                        *
                                      </span>
                                    )}
                                  </label>
                                )}
                                {renderInput(input, options, value)}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}

              {/* Payment summary on the final step */}
              {paymentRequired &&
                selectedCategory &&
                currentStep === formGroups.length - 1 &&
                !processingPayment && (
                  <div
                    className="mt-5 rounded-xl border bg-white p-4 sm:p-5"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        style={{ color: 'var(--sky2)' }}
                      >
                        <path
                          fillRule="evenodd"
                          d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span
                        className="text-sm font-semibold"
                        style={{ color: 'var(--ink)' }}
                      >
                        Payment summary
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-sm">
                        <span style={{ color: 'var(--muted)' }}>
                          Registration fee
                        </span>
                        <span
                          className="font-medium tabular-nums"
                          style={{ color: 'var(--text)' }}
                        >
                          {selectedCategory.normal_fee &&
                            parseFeeAmount(selectedCategory.normal_fee) >
                              parseFeeAmount(selectedCategory.fee) && (
                              <span
                                className="mr-2 font-normal line-through"
                                style={{ color: 'var(--muted)' }}
                              >
                                {selectedCategory.normal_fee}
                              </span>
                            )}
                          {selectedCategory.fee}
                        </span>
                      </div>
                      <div
                        className="flex items-center justify-between pt-3 border-t"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <span
                          className="text-sm font-semibold"
                          style={{ color: 'var(--ink)' }}
                        >
                          Total due
                        </span>
                        <span
                          className="text-lg font-bold tabular-nums"
                          style={{ color: 'var(--red)' }}
                        >
                          {extractCurrency(selectedCategory.fee)}{' '}
                          {parseFeeAmount(
                            selectedCategory.fee,
                          ).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <p
                      className="text-xs mt-3 flex items-center gap-1.5"
                      style={{ color: 'var(--muted)' }}
                    >
                      <svg
                        className="w-3.5 h-3.5 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                      Payments are processed securely. Card details never reach
                      our servers.
                    </p>
                  </div>
                )}

              {processingPayment && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                    <p className="text-sm font-medium text-blue-800">
                      Preparing your secure payment…
                    </p>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div
                className="flex justify-between mt-8 pt-6 border-t"
                style={{ borderColor: 'var(--border)' }}
              >
                <button
                  type="button"
                  onClick={
                    currentStep > 0
                      ? prevStep
                      : () => setSelectedCategory(null)
                  }
                  disabled={submitting || processingPayment}
                  className="px-6 py-2 border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {currentStep > 0 ? 'Previous' : 'Change category'}
                </button>
                {currentStep < formGroups.length - 1 ? (
                  <button
                    // Distinct keys keep React from reusing one DOM node for
                    // both buttons: mutating `type` from button to submit
                    // mid-click makes the same click submit the form.
                    key="next"
                    type="button"
                    onClick={nextStep}
                    disabled={submitting || processingPayment}
                    className="px-6 py-2 rounded-lg text-white font-semibold transition-colors disabled:opacity-50"
                    style={{ background: 'var(--red)' }}
                  >
                    Next
                  </button>
                ) : (
                  <button
                    key="submit"
                    type="submit"
                    disabled={submitting || processingPayment}
                    className="px-6 py-2 rounded-lg text-white font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
                    style={{ background: 'var(--red)' }}
                  >
                    {(submitting || processingPayment) && (
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    )}
                    {processingPayment
                      ? 'Processing…'
                      : submitting
                        ? 'Submitting…'
                        : paymentRequired
                          ? 'Proceed to payment'
                          : 'Submit registration'}
                  </button>
                )}
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Mastercard embedded checkout */}
      {paymentSession && selectedCategory && (
        <PaymentModal
          session={paymentSession}
          amount={parseFeeAmount(selectedCategory.fee)}
          currency={extractCurrency(selectedCategory.fee)}
          categoryName={decodeHtml(selectedCategory.name_english)}
          customerEmail={(formValues[EMAIL_INPUT] as string) || ''}
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setProcessingPayment(false);
            setSubmitting(false);
          }}
        />
      )}
    </div>
  );
}
