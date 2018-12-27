import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

// Grab the template script

const theIssueTemplate = `
# Mythril Report for {{contractName}} {{file_link sourcePath}}

**Table of Contents**

{{#each issues}}
- [Issue {{add1 @index}} {{type}}: {{title}}]({{issue_markdown_link @index type title}})
{{/each}}
- [Analysis information](#analysis-info)

{{#each issues}}
## Issue {{add1 @index}} {{type}}: {{title}}

{{message}}

* [{{ruleId}}]({{swc_url ruleId}})
{{#if address}}
* Bytecode offset: offset {{address}}
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

// Turn 0-index numbering of array into 1-index numbering of issues
Handlebars.registerHelper('add1', function(value: string): number {
    return parseInt(value, 10) + 1;
});

const swc_prefix = 'https://github.com/SmartContractSecurity/SWC-registry/blob/master/entries';

// Return a SWC-url for a given swc-id.
Handlebars.registerHelper('swc_url', function(swc_id: string): string {
    return `${swc_prefix}/${swc_id}.md`;
});

// Return a markding base filename and link file.
Handlebars.registerHelper('file_link', function(filePath: string): string {
    return `[${path.basename(filePath)}](file:///${filePath})`;
});

// Return an internal Markdown issue link for an issue
Handlebars.registerHelper('issue_markdown_link', function(index: number, severity: string, title: string): string {
    let lowerTitle: string = title.toLowerCase();
    if (lowerTitle.indexOf(' ') >= 0) {
        lowerTitle = title.split(' ').join('-');
    }
    return `#issue-${index + 1}-${severity.toLowerCase()}-${lowerTitle}`;
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
    const reportPath = path.join(mythReportDir,
                                 `${mdData.contractName}-${mdData.secsSinceEpoch}.md`);
    fs.writeFileSync(reportPath, theCompiledMarkdown);
    return reportPath;
}
