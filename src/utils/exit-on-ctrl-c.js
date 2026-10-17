const INTERRUPTED_EXIT_CODE = 130;

/**
 * inquirer 6 answers Ctrl-C by closing its prompt and sending its own process SIGINT. That signal
 * is handled asynchronously, and with the prompt closed nothing keeps the process alive: it exits
 * 0 first. Any caller, `forest start` included, then reads an interrupted command as a success and
 * carries on. Exit as an interrupt right away instead.
 */
module.exports = function exitOnCtrlC(inquirerUI) {
  const UI = inquirerUI;
  if (UI.prototype.exitsOnCtrlC) return;

  const { onForceClose } = UI.prototype;
  UI.prototype.onForceClose = function onForceCloseAndExit(...args) {
    onForceClose.apply(this, args);
    // The same handler serves the process 'exit' event, which passes the exit code. Ctrl-C, from
    // readline's 'SIGINT' event, passes nothing.
    if (!args.length) process.exit(INTERRUPTED_EXIT_CODE);
  };
  UI.prototype.exitsOnCtrlC = true;
};
