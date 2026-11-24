import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  /** O que mostrar quando um filho lança durante a renderização. Função recebe `reset` (tentar de novo) e o erro. */
  fallback: ReactNode | ((reset: () => void, error: unknown) => ReactNode);
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: unknown;
  falhou: boolean;
}

/**
 * Impede que uma falha de renderização deixe a SPA em branco. Para trocar de "tentativa" quando a entrada muda
 * (outra rota, outro texto), use `key` no boundary: a chave nova remonta e limpa o erro.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, falhou: false };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error, falhou: true };
  }

  componentDidCatch(_error: unknown, _info: ErrorInfo) {
    // Sem log do conteúdo: o texto do relatório pode ser sensível. O fallback já informa o usuário.
  }

  reset = () => this.setState({ error: null, falhou: false });

  render() {
    if (!this.state.falhou) return this.props.children;
    const { fallback } = this.props;
    return typeof fallback === 'function' ? fallback(this.reset, this.state.error) : fallback;
  }
}
