// The plan keeps its original registration, mask and measurements in either language.
export function localizedPlanImage(original, english, search = globalThis.location?.search || '') {
  return new URLSearchParams(search).get('lang') === 'en' ? english : original;
}
