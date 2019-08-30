import * as path from "path";

export function isPathEqual(fsPath1: string, fsPath2: string, relativeFunc: pathRelativeFunc = path.relative): boolean {
    const relativePath: string = relativeFunc(fsPath1, fsPath2);
    return relativePath === "";
}

export function isSubpath(expectedParent: string, expectedChild: string, relativeFunc: pathRelativeFunc = path.relative): boolean {
    const relativePath: string = relativeFunc(expectedParent, expectedChild);
    return relativePath !== "" && !relativePath.startsWith("..") && relativePath !== expectedChild;
}

type pathRelativeFunc = (fsPath1: string, fsPath2: string) => string;