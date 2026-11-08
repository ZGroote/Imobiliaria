(() => {
  "use strict";
  const form = document.querySelector("[data-contato-form]");
  if (!form) return;
  const en = /^en(?:-|$)/i.test(document.documentElement.lang || "");
  const T = en ? {
    sendingLabel: "Sending…", sendLabel: "Send message",
    name: "Please enter your name (up to 120 characters).", email: "Please enter a valid email address.",
    company: "Please keep the company name under 160 characters.", message: "Please write between 10 and 5,000 characters about your project.",
    check: "Please check the highlighted field.", sending: "Sending your message…",
    accepted: "Thank you — your message has been submitted. We’ll reply by email.",
    processing: "Your request is still processing. Please wait a minute and try again. Your text is kept here.",
    limit: "We’ve received too many requests. Please try later, or contact us by email below.",
    long: "Your message is too long. Please shorten it and try again.",
    invalid: "Please check your details and try again. Your text is kept here.",
    failed: "We couldn’t confirm your submission. Your text is kept here. Please try again, or use the email address below.",
  } : {
    sendingLabel: "Enviando…", sendLabel: "Enviar mensagem",
    name: "Informe seu nome (até 120 caracteres).", email: "Informe um e-mail válido.",
    company: "Use até 160 caracteres no nome da empresa.", message: "Escreva de 10 a 5.000 caracteres sobre o seu projeto.",
    check: "Confira o campo destacado.", sending: "Enviando sua mensagem…",
    accepted: "Obrigado! Sua mensagem foi enviada. Responderemos por e-mail.",
    processing: "Seu envio ainda está sendo processado. Aguarde um minuto e tente de novo. Seu texto continua aqui.",
    limit: "Recebemos muitos envios. Tente mais tarde ou escreva para o e-mail abaixo.",
    long: "Sua mensagem está longa demais. Encurte e tente de novo.",
    invalid: "Confira seus dados e tente de novo. Seu texto continua aqui.",
    failed: "Não conseguimos confirmar o envio. Seu texto continua aqui. Tente de novo ou use o e-mail abaixo.",
  };
  const fields = Object.fromEntries(["name", "email", "company", "message", "website"].map(name =>
    [name, form.querySelector(`[name="${name}"]`)]));
  const status = form.querySelector("[data-contato-status]");
  const submit = form.querySelector("[type='submit']");
  const label = submit.querySelector("[data-contato-submit-text]");
  const controls = [...form.querySelectorAll("input, textarea, button")];
  let busy = false, request = null;
  const show = (state, message, focus = false) => {
    status.dataset.state = state;
    status.textContent = message;
    if (focus) status.focus();
  };
  const setBusy = value => {
    busy = value;
    form.setAttribute("aria-busy", String(value));
    controls.forEach(control => { control.disabled = value; });
    label.textContent = value ? T.sendingLabel : T.sendLabel;
  };
  const validate = () => {
    const values = Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.value.trim()]));
    const errors = {
      name: !values.name || values.name.length > 120 ? T.name : "",
      email: values.email.length > 254 || !/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(values.email) ? T.email : "",
      company: values.company.length > 160 ? T.company : "",
      message: values.message.length < 10 || values.message.length > 5000 ? T.message : "",
    };
    let invalid = null;
    for (const name of ["name", "email", "company", "message"]) {
      const field = fields[name];
      field.setCustomValidity(errors[name]);
      const valid = field.checkValidity();
      if (valid) field.removeAttribute("aria-invalid");
      else { field.setAttribute("aria-invalid", "true"); invalid ||= field; }
    }
    if (invalid) {
      show("error", T.check);
      invalid.focus();
      invalid.reportValidity();
      return null;
    }
    return {...values, locale: en ? "en" : "pt-BR"};
  };
  setBusy(false);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    const values = validate();
    if (!values) return;
    const fingerprint = JSON.stringify(values);
    const controller = new AbortController();
    let timeout;
    setBusy(true);
    show("sending", T.sending);
    try {
      // An uncertain response is retried with the same ID; editing the message starts a new request.
      if (!request || request.fingerprint !== fingerprint) request = {fingerprint, id: crypto.randomUUID()};
      timeout = setTimeout(() => controller.abort(), 20000);
      const response = await fetch("/api/contact", {
        method: "POST", headers: {"Content-Type": "application/json"}, credentials: "same-origin",
        body: JSON.stringify({...values, requestId: request.id}), signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (response.status === 200 && data?.status === "accepted") {
        form.reset();
        request = null;
        show("accepted", T.accepted, true);
      } else if (response.status === 202 && data?.status === "processing") {
        show("processing", T.processing, true);
      } else {
        if (response.status === 409) request = null;
        const message = response.status === 429 ? T.limit :
          response.status === 413 ? T.long :
          response.status === 400 ? T.invalid :
          T.failed;
        show("error", message, true);
      }
    } catch {
      show("error", T.failed, true);
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }
  });
})();
