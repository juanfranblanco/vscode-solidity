

import * as vscode from 'vscode';

export type CoverageData = {
    file: string;
    lines: coverageTypeSummary<coverageDetail>;
    functions: coverageTypeSummary<coverageDetailFunction>;
}

type coverageDetail = {
    line: number;
    hit: 0 | 1;
}

type coverageDetailFunction = coverageDetail & {
    name: string;
}

type coverageTypeSummary<Detail> = {
    found: number;
    hit: number;
    details: Detail[];
}

type coverageDataByFile = Record<string, CoverageData>;

export type CoverageDecorationPair = {
    decorator: vscode.TextEditorDecorationType;
    options: vscode.DecorationOptions[];
};

export const computeDecoratorsForDocuments = (docs: vscode.TextDocument[], data: coverageDataByFile, fileRoot: string): Record<string, CoverageDecorationPair[]> => {
    const allFiles: Record<string, CoverageDecorationPair[]> = {}

    Object.entries(data).forEach(([file, coverage]) => {

        const covered: vscode.DecorationOptions[] = [];
        const uncovered: vscode.DecorationOptions[] = [];

        const document = docs.find((d) => {
            return d.fileName.replace(fileRoot, "") === file;
        })
        if (!document) {
            return;
        }
        coverage.lines.details.forEach((detail) => {
            const range = new vscode.Range(
                new vscode.Position(detail.line-1, 0),
                new vscode.Position(detail.line-1, 1),
            );
            if (detail.hit === 1) {
                covered.push({
                    range
                })
                return;
            }
            uncovered.push({
                range
            });
        });

        allFiles[document.uri.path] = [
            {
                decorator: vscode.window.createTextEditorDecorationType({
                    backgroundColor: 'rgba(0, 200, 0, 0.3)',
                }),
                options: covered,
            },
            {
                decorator: vscode.window.createTextEditorDecorationType({
                    backgroundColor: 'rgba(200, 0, 0, 0.3)',
                }),
                options: uncovered,
            }
        ];
    })
    return allFiles;
}
