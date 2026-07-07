interface Props {
  onLogin?: () => void;
  onSignup?: () => void;
}

export function AuthActions({ onLogin, onSignup }: Props) {
  return (
    <div className="mx-auto mt-4 flex w-full max-w-[295px] items-center justify-between gap-4">
      <button
        type="button"
        onClick={onLogin}
        className="h-12 sm:h-14 w-[140px] sm:w-[155px] rounded-full border border-fuchsia-400/40 bg-white/5 text-sm font-semibold text-white/90 backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white"
      >
        Entrar
      </button>
      <button
        type="button"
        onClick={onSignup}
        className="text-sm font-medium text-white/70 underline underline-offset-4 transition-colors hover:text-fuchsia-200"
      >
        Cadastrar-se
      </button>
    </div>
  );
}
