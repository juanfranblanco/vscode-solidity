import * as vscode from 'vscode';

export class OutputChannelService {
    // Singleton instance
    private static instance: OutputChannelService | null = null;

    // Output channel reference
    private nethereumCodeGenerationOuputChannel: vscode.OutputChannel;
    private solidityCompilerOutputChannel: vscode.OutputChannel;

    // Get the singleton instance of the OutputChannelService
    public static getInstance(): OutputChannelService {
        if (!this.instance) {
            this.instance = new OutputChannelService();
        }
        return this.instance;
    }

    public getNethereumCodeGenerationOutputChannel(): vscode.OutputChannel {
        return this.nethereumCodeGenerationOuputChannel;
    }

    public getSolidityCompilerOutputChannel(): vscode.OutputChannel {
        return this.solidityCompilerOutputChannel;
    }

    // Method to dispose of the output channel (useful during extension deactivation)
    public dispose(): void {
        if (this.nethereumCodeGenerationOuputChannel) {
            this.nethereumCodeGenerationOuputChannel.dispose();
            OutputChannelService.instance = null; // Reset instance for future usage if needed
        }
    }

      // Private constructor to prevent direct instantiation
      private constructor() {
        // Create the output channel upon instantiation
        this.nethereumCodeGenerationOuputChannel = vscode.window.createOutputChannel('Nethereum Code Generation');
        this.solidityCompilerOutputChannel = vscode.window.createOutputChannel('Solidity Compiler');
    }

}
