import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import * as vscode from 'vscode';
import * as util from 'util';


const fsExists = util.promisify(fs.exists);
const fsMkdir = util.promisify(fs.mkdir);
const writeFile = util.promisify(fs.writeFile);

const packageJSON = path.join(__dirname, '../../../../package.json');
const packageVersion = JSON.parse(fs.readFileSync(packageJSON, 'utf-8')).version;


// Grab the template script

const theIssueTemplate = `
# MythX Report for {{contractName}} {{file_link sourcePath}}

**Table of Contents**

{{#each groupedEslintIssues}}
{{#each messages}}
- [Issue {{add1 @index}} {{mythXseverity}}: {{swcTitle}}]({{issue_markdown_link @index mythXseverity swcTitle swcID}})
{{/each}}
{{/each}}

* [Analysis information](#analysis-info)

{{#each groupedEslintIssues}}
{{#each messages}}

## Issue {{add1 @index}} {{mythXseverity}}: {{swcTitle}} [{{swcID}}]({{swc_url swcID}})

{{#if markedText}}
\`\`\`
{{{markedText}}}
\`\`\`
{{/if}}

{{head}}

{{tail}}

{{#if address}}
* Bytecode offset: {{address}}
{{/if}}
* sourceMap: {{sourceMap}}
{{#if line}}
* Starting at line {{line}}, column: {{column}}
{{/if}}
{{#if endLine}}
* Ending at line: {{endLine}}, column: {{endCol}}
{{/if}}

{{/each}}
{{/each}}

## Analysis Info
* Analysis Mode: {{analysisMode}}
* Contract Name {{contractName}}
* Source Path:  {{file_link sourcePath}}
* Compiler: {{compilerVersion}}
* Timeout: {{timeout}} secs
* Run time: {{status.runTime}} msecs
* Queue time: {{status.queueTime}} msecs
* UUID: {{status.uuid}}
* User: {{status.submittedBy}}

## MythX Version Information
* API version: {{status.apiVersion}}
* Harvey version: {{status.harveylVersion}}
* Mythril version: {{status.mythrilVersion}}
* Maru version: {{status.maruVersion}}
* Maestro version: {{status.maestroVersion}}
* VSCode Solidity Extension: {{packageVersion}}
`;

/**
const theIssueTemplate = fs.readFileSync('./issue-report.handlebars', 'utf8');
*/

// FIXME: Should be in some place more generic.
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
Handlebars.registerHelper('issue_markdown_link', function(index: number, mythXseverity: string, title: string,
                                                          ruleId: string): string {
    let lowerTitle: string = title.toLowerCase();
    if (lowerTitle.indexOf(' ') >= 0) {
        lowerTitle = title.split(' ').join('-');
    }
    return `#issue-${index + 1}-${mythXseverity.toLowerCase()}-${lowerTitle}-${ruleId}`;
});

// Compile the template
const theTemplate = Handlebars.compile(theIssueTemplate);

/*
mdData is expected to have:
   compilerVersion  string
   contractName     string
   reportsDir       directory path
   sourcePath       file path
*/
export function writeMarkdownReport(mdData: any) {
    // Pass our data to the template
    const mythReportDir = mdData.reportsDir;
    mdData.packageVersion = packageVersion;
    const theCompiledMarkdown = theTemplate(mdData);
    if (!fs.existsSync(mythReportDir)) {
        fs.mkdirSync(mythReportDir);
    }
    const now = new Date();
    const filePrefix = `${mdData.contractName}-${mdData.status.uuid}`;
    const reportPath = path.join(mythReportDir, `${filePrefix}.md`);
    fs.writeFileSync(reportPath, theCompiledMarkdown);
    const stringify = JSON.stringify(mdData, null, 4);

    // write in JSON format in case we want in the future to look at these.
    const reportJSONPath = path.join(mythReportDir, `${filePrefix}.json`);
    fs.writeFileSync(reportJSONPath, stringify , 'utf-8');
    parseMythXReport(mdData);
    return reportPath;
}

/*
mdData is expected to have:
   compilerVersion  string
   contractName     string
   reportsDir       directory path
   sourcePath       file path
*/
export async function writeMarkdownReportAsync(mdData: any) {
    // Pass our data to the template
    const mythReportDir = mdData.reportsDir;
    mdData.packageVersion = packageVersion;
    const theCompiledMarkdown = theTemplate(mdData);
    const isReportDirExists = await fsExists(mythReportDir);
    if (!isReportDirExists) {
        await fsMkdir(mythReportDir);
    }

    const filePrefix = `${mdData.contractName}-${mdData.status.uuid}`;
    const reportPath = path.join(mythReportDir, `${filePrefix}.md`);
    await writeFile(reportPath, theCompiledMarkdown);
    const stringify = JSON.stringify(mdData, null, 4);

    // write in JSON format in case we want in the future to look at these.
    const reportJSONPath = path.join(mythReportDir, `${filePrefix}.json`);
    await writeFile(reportJSONPath, stringify , 'utf-8');
    parseMythXReport(mdData);
    return reportPath;
}

// Takes a reportJSON object and creates diagnostics for these
export function parseMythXReport(reportJSON: any) {
    // The code you place here will be executed every time your command is executed
    const issueCollections: any = {};

    // Parse Report creating diagnostics and update file
    for (const issueGroup of reportJSON.groupedEslintIssues) {
        const p = issueGroup.filePath;
        for (const issue of issueGroup.messages) {
            const diagnostic = {
                code: issue.ruleId,
                message: issue.message,
                range: new vscode.Range(new vscode.Position(issue.line - 1, issue.column),
                                        new vscode.Position(issue.endLine - 1, issue.endCol)),
                relatedInformation: [],
                severity: issue.mythXseverity,
                source: 'MythX',
            };
            if (!issueCollections[p]) {
                issueCollections[p] = [];
            }
            issueCollections[p].push(diagnostic);
        }
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
