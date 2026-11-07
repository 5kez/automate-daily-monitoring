declare module 'n8n-core' {
  export interface IExecuteFunctions {
    getCredentials(name: string): Promise<any>;
    getNodeParameter(name: string, index: number): any;
  }
}

declare module 'n8n-workflow' {
  export interface INodeType {
    description: any;
    execute(this: any): Promise<any>;
  }

  export interface INodeTypeDescription {}
  export interface INodeExecutionData {}
  export interface ICredentialType {}
  export interface INodeProperties {}
}
