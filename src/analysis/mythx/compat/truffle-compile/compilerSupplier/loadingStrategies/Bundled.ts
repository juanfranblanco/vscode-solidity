import LoadingStrategy from './LoadingStrategy';


export default class Bundled extends LoadingStrategy {
  public load() {
    return this.getBundledSolc();
  }

  public getBundledSolc() {
    this.removeListener();
    return require('solc');
  }
}
