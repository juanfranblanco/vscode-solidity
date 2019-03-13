import * as colors from 'colors';
import * as TruffleError from 'truffle-error';


export default class CompileError extends TruffleError {
  public message: string;

  constructor(message: string) {
    const fancy_message = message.trim() + '\n' + colors.red('Compilation failed. See above.');
    const normal_message = message.trim();

    super(normal_message);
    this.message = fancy_message;
  }
}
