import { ParsedDocument } from './ParsedDocument';
import { ParsedCode } from './parsedCode';
import { ParsedContract } from './parsedContract';


export class ParsedContractIs extends ParsedCode {
    public contract: ParsedContract;
    private contractReference: ParsedContract = null;
    public initialise(element: any, contract: ParsedContract, document: ParsedDocument, isGlobal: boolean) {
        this.element = element;
        this.name = element.library;
        this.document = document;
        this.contract = contract;
    }

    public initialiseContractReference(): ParsedContract {
        if (this.contractReference != null) { return this.contractReference; }
        this.contractReference = this.document.findContractByName(this.name);
        if (this.contractReference !== undefined && this.contractReference  !== null) {
            this.contractReference.initialiseExtendContracts();
        }
        return this.contractReference;
    }

    public getContractReference(): ParsedContract {
        return this.initialiseContractReference();
    }
}
