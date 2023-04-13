'use strict';
import * as fs from 'fs';
import * as path from 'path';

export function formatPath(contractPath: string) {
        return contractPath.replace(/\\/g, '/');
}

/**
 * Replaces remappings in the first array with matches from the second array,
 * then it concatenates only the unique strings from the 2 arrays.
 *
 * It splits the strings by '=' and checks the prefix of each element
 * @param remappings first array of remappings strings
 * @param replacer second array of remappings strings
 * @returns an array containing unique remappings
 */
export function replaceRemappings(remappings: string[], replacer: string[]): string[] {
        remappings.forEach(function (remapping, index) {
                const prefix = remapping.split('=')[0];
                for (const replaceRemapping of replacer) {
                        const replacePrefix = replaceRemapping.split('=')[0];
                        if (prefix === replacePrefix) {
                                remappings[index] = replaceRemapping;
                                break;
                        }
                }
        });
        return [...new Set([...remappings, ...replacer])];
}

export function findDirUpwardsToCurrentDocumentThatContainsAtLeastFileNameSync(filenames: string[], currentDocument: string, rootPath: string) {
        let currentDir = path.dirname(path.resolve(currentDocument));
        
        while (currentDir !== rootPath) {
          
          if (exitsAnyFileSync(filenames, currentDir)) {
            return currentDir;
          }
      
          currentDir = path.dirname(currentDir);
        }
      
        return null;
      }

export function exitsAnyFileSync(filenames: string[], dir: string) {
        for (const fileName of filenames) {
                const file = path.join(dir, fileName);
                if (fs.existsSync(file)) {
                        return true;
                }
        }
        return false;
}
