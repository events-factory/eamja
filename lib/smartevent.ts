// Server-side SmartEvent configuration.
//
// The event code identifies the EAMJA Conference to SmartEvent and is sent
// either as an `Authorization` header (GET reads) or as an `event_code` form
// field (POSTs). Both values are overridable from the environment; point them
// at https://sandbox.smartevent.rw/Api to work against sandbox.
export const SMARTEVENT_API_URL =
  process.env.SMARTEVENT_API_URL || 'https://app.smartevent.rw/Api';

export const EVENT_CODE =
  process.env.SMARTEVENT_EVENT_CODE ||
  'qPwx/0n3s/atmj/gFgeQA3l4M0ErS2I0SGxCRi9pQTF1ZldBYWc9PQ==';
