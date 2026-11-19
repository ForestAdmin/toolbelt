export default class ExitCodeError extends Error {
  constructor(message: string, readonly exitCode: number | null) {
    super(message);
    this.name = 'ExitCodeError';
  }
}
