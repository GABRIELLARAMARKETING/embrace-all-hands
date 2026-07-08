/* Login do Painel de Gerentes — Helix
   HTML/CSS/JS puro. Preparado para integração futura com backend.        */

(function () {
  "use strict";

  const form = document.getElementById("loginForm");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const toggleBtn = document.getElementById("togglePassword");
  const submitBtn = document.getElementById("submitBtn");
  const submitLabel = submitBtn.querySelector(".btn__label");
  const alertBox = document.getElementById("formAlert");
  const yearEl = document.getElementById("year");

  yearEl.textContent = String(new Date().getFullYear());

  // Foco inicial no e-mail
  window.requestAnimationFrame(() => emailInput.focus());

  /* ---------- validação ---------- */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function setFieldError(fieldName, message) {
    const field = document.querySelector(`[data-field="${fieldName}"]`);
    if (!field) return;
    const errorEl = field.querySelector(".field__error");
    if (message) {
      field.classList.add("is-error");
      errorEl.textContent = message;
    } else {
      field.classList.remove("is-error");
      errorEl.textContent = "";
    }
  }

  function validateEmail(value) {
    const v = value.trim();
    if (!v) return "Informe seu e-mail profissional.";
    if (v.length > 255) return "E-mail muito longo.";
    if (!EMAIL_RE.test(v)) return "E-mail inválido.";
    return "";
  }

  function validatePassword(value) {
    if (!value) return "Informe sua senha.";
    if (value.length < 6) return "A senha deve ter ao menos 6 caracteres.";
    if (value.length > 128) return "Senha muito longa.";
    return "";
  }

  /* ---------- alertas ---------- */
  function showAlert(type, message) {
    alertBox.hidden = false;
    alertBox.textContent = message;
    alertBox.classList.remove("alert--error", "alert--success");
    alertBox.classList.add(type === "success" ? "alert--success" : "alert--error");
  }
  function clearAlert() {
    alertBox.hidden = true;
    alertBox.textContent = "";
    alertBox.classList.remove("alert--error", "alert--success");
  }

  /* ---------- mostrar/ocultar senha ---------- */
  toggleBtn.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    toggleBtn.setAttribute("aria-pressed", String(isHidden));
    toggleBtn.setAttribute(
      "aria-label",
      isHidden ? "Ocultar senha" : "Mostrar senha",
    );
    const eye = toggleBtn.querySelector('[data-icon="eye"]');
    const off = toggleBtn.querySelector('[data-icon="eye-off"]');
    eye.hidden = isHidden;
    off.hidden = !isHidden;
    passwordInput.focus();
  });

  /* ---------- remover mensagens ao editar ---------- */
  emailInput.addEventListener("input", () => {
    setFieldError("email", "");
    if (!alertBox.hidden) clearAlert();
  });
  passwordInput.addEventListener("input", () => {
    setFieldError("password", "");
    if (!alertBox.hidden) clearAlert();
  });

  /* ---------- estado de loading ---------- */
  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.classList.toggle("is-loading", loading);
    submitLabel.textContent = loading ? "Autenticando..." : "Entrar no Painel";
  }

  /* ---------- submit ---------- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAlert();

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const remember = document.getElementById("remember").checked;

    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);

    setFieldError("email", emailErr);
    setFieldError("password", passErr);

    if (emailErr || passErr) {
      (emailErr ? emailInput : passwordInput).focus();
      return;
    }

    setLoading(true);

    try {
      // -------------------------------------------------------
      // 🔌 Integração real de autenticação vai aqui.
      //
      // Exemplo (troque pela sua API):
      //
      // const res = await fetch("/api/gerente/login", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ email, password, remember }),
      //   credentials: "include", // cookie de sessão httpOnly
      // });
      // if (!res.ok) throw new Error("Credenciais inválidas.");
      // const data = await res.json();
      // // ⚠️ Nunca armazenar senha em localStorage.
      // // Prefira cookies httpOnly gerenciados pelo backend.
      // window.location.assign("/gerente/painel");
      // -------------------------------------------------------

      // Simulação de autenticação (remover ao integrar backend real)
      await new Promise((r) => setTimeout(r, 1400));

      showAlert("success", "Login validado. Redirecionando para o painel...");
      // window.location.assign("/gerente/painel");
    } catch (err) {
      showAlert(
        "error",
        err && err.message
          ? err.message
          : "Não foi possível autenticar. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  });

  // Enter em qualquer campo submete o formulário nativamente.
})();
