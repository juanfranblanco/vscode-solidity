import * as path from 'path';
import * as originalRequire from 'original-require';
import LoadingStrategy from './LoadingStrategy';

export default class Local extends LoadingStrategy {
  public load(localPath) {
    return this.getLocalCompiler(localPath);
  }

  public getLocalCompiler(localPath) {
    let compiler, compilerPath;
    compilerPath = path.isAbsolute(localPath)
      ? localPath
      : path.resolve(process.cwd(), localPath);

    try {
      compiler = originalRequire(compilerPath);
      this.removeListener();
    } catch (error) {
      throw this.errors('noPath', localPath, error);
    }
    return compiler;
  }
}
