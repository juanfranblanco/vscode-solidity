import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import * as vscode from 'vscode';

// Grab the template script

const theIssueTemplate = `
# Mythx Report for {{contractName}} {{file_link sourcePath}}

**Table of Contents**

{{#each issues}}
- [Issue {{add1 @index}} {{type}}: {{title}}]({{issue_markdown_link @index type title ruleId}})
{{/each}}
- [Analysis information](#analysis-info)

{{#each issues}}
## Issue {{add1 @index}} {{type}}: {{title}} [{{ruleId}}]({{swc_url ruleId}})

{{message}}
{{#if markedText}}

\`\`\`
{{{markedText}}}
\`\`\`

{{/if}}
{{#if address}}
* Bytecode offset: {{address}}
{{/if}}
* Tool: {{tool}}
{{#if function}}
* Function {{function}}
{{/if}}
{{#if line}}
* Starting at line {{line}}, column: {{column}}
{{/if}}
{{#if endLine}}
* Ending at line: {{endLine}}, column: {{endCol}}
{{/if}}

{{/each}}
## Analysis Info
* Contract Name {{contractName}}
* Source Path:  {{file_link sourcePath}}
* Compiler: {{compilerVersion}}
`;

/**
const theIssueTemplate = fs.readFileSync('./issue-report.handlebars', 'utf8');
*/

// FIXME: Shhould be in some place more generic.
const diagnosticsCollection = vscode.languages.createDiagnosticCollection(`Mythx-Reports`);

// Turn 0-index numbering of array into 1-index numbering of issues
Handlebars.registerHelper('add1', function(value: string): number {
    return parseInt(value, 10) + 1;
});

const swc_prefix = 'https://github.com/SmartContractSecurity/SWC-registry/blob/master/entries';

// Return a SWC-url for a given swc-id.
Handlebars.registerHelper('swc_url', function(swc_id: string): string {
    return `${swc_prefix}/${swc_id}.md`;
});

// Return a markdown base filename and link file.
Handlebars.registerHelper('file_link', function(filePath: string): string {
    return `[${path.basename(filePath)}](file:///${filePath})`;
});

// Return an internal Markdown issue link for an issue
Handlebars.registerHelper('issue_markdown_link', function(index: number, severity: string, title: string,
                                                          ruleId: string): string {
    let lowerTitle: string = title.toLowerCase();
    if (lowerTitle.indexOf(' ') >= 0) {
        lowerTitle = title.split(' ').join('-');
    }
    return `#issue-${index + 1}-${severity.toLowerCase()}-${lowerTitle}-${ruleId}`;
});

// Compile the template
const theTemplate = Handlebars.compile(theIssueTemplate);

/*
mdData is expected to have:
   compilerVersion  string
   contractName     string
   reportsDir       directory path
   sourcePath       file path
   secsSinceEpoc    number
*/
export function writeMarkdownReport(mdData: any) {
    // Pass our data to the template
    const mythReportDir = mdData.reportsDir;
    const theCompiledMarkdown = theTemplate(mdData);
    if (!fs.existsSync(mythReportDir)) {
        fs.mkdirSync(mythReportDir);
    }
    const now = new Date();
    const filePrefix = `${mdData.contractName}-${mdData.secsSinceEpoch}`;
    const reportPath = path.join(mythReportDir, `${filePrefix}.md`);
    fs.writeFileSync(reportPath, theCompiledMarkdown);
    const stringify = JSON.stringify(mdData, null, 4);

    // write in JSON format in case we want in the future to look at these.
    const reportJSONPath = path.join(mythReportDir, `${filePrefix}.json`);
    fs.writeFileSync(reportJSONPath, stringify , 'utf-8');
    parseMythXReport(mdData);
    return reportPath;
}

// Takes a reportJSON object and creates diagnostics for these
export function parseMythXReport(reportJSON: any) {
    // The code you place here will be executed every time your command is executed
    const issueCollections: any = {};

    for (const issue of reportJSON.issues) {
        // Parse Report creating diagnostics and update file
        const p = issue.path;
        const diagnostic = {
            code: issue.ruleId,
            message: issue.message,
            range: new vscode.Range(new vscode.Position(issue.line - 1, issue.column),
                                    new vscode.Position(issue.endLine - 1, issue.endCol)),
            relatedInformation: [],
            severity: issue.type,
            source: 'MythX',
        };
        if (!issueCollections[p]) {
            issueCollections[p] = [];
        }
        issueCollections[p].push(diagnostic);
    }

    for (const p of Object.keys(issueCollections)) {
        const uri = vscode.Uri.file(p);
        /**
         * FIXME: Move this code to more generic place.
         * Problems tab should not depend on MD reports
         * We should report to vscode tab as soon as possible
         */
        vscode.window.showTextDocument(uri).then(textDocument => {
            diagnosticsCollection.clear();
            diagnosticsCollection.set(uri, issueCollections[p]);
        });
    }
}

// Read a JSON file and handle diagnostics for that.
export function parseMythXReportFile(reportJSONPath: string) {
    // The code you place here will be executed every time your command is executed
    if (!fs.existsSync(reportJSONPath)) {
        vscode.window.showInformationMessage(`MythX Report ${reportJSONPath} not found.`);
    }
    const reportJSON = JSON.parse(fs.readFileSync(reportJSONPath, 'utf-8'));
    parseMythXReport(reportJSON);
}
