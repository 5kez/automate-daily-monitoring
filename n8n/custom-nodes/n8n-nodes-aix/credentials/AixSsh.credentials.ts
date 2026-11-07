import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class AixSsh implements ICredentialType {
  name = 'aixSsh';
  displayName = 'AIX SSH';
  properties: INodeProperties[] = [
    { name: 'host', displayName: 'Host', type: 'string', default: '' },
    { name: 'port', displayName: 'Port', type: 'number', default: 22 },
    { name: 'username', displayName: 'Username', type: 'string', default: '' },
    {
      name: 'password',
      displayName: 'Password',
      type: 'string',
      typeOptions: { password: true },
      default: '',
    },
  ];
}
