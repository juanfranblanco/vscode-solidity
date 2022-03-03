'use strict';

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
