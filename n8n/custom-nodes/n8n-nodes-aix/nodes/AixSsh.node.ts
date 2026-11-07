import type { IExecuteFunctions } from 'n8n-core';
import type { INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { Client } from 'ssh2';

export class AixSsh implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'AIX Topas RAW',
    name: 'aixSsh',
    group: ['transform'],
    version: 1,
    description: 'Run topas in non-interactive mode and return clean output',
    defaults: { name: 'AIX Topas RAW' },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [{ name: 'aixSsh', required: true }],
    properties: [
      {
        name: 'captureMs',
        displayName: 'Capture (ms)',
        type: 'number',
        default: 3549,
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const creds = await this.getCredentials('aixSsh');
    const captureMs = this.getNodeParameter('captureMs', 0) as number;

    return await new Promise((resolve) => {
      const conn = new Client();

      let raw = '';
      let stderr = '';
      let done = false;

      const finish = (reason: string) => {
        if (done) return;
        done = true;
        try { conn.end(); } catch {}

        resolve([[{
          json: {
            command: 'export TERM=xterm; topas',
            captureMs,
            reason,
            raw,
            stderr,
            rawLength: raw.length,
          },
        }]]);
      };

      conn.on('ready', () => {
        // ⭐ จุดสำคัญที่สุด: set TERM ผ่าน command โดยตรง
        conn.exec(
          'export TERM=xterm; topas',
          { pty: false },
          (err, stream) => {
            if (err) return finish('exec-error');

            const hard = setTimeout(() => {
              try { stream.close(); } catch {}
              finish('hard-timeout');
            }, captureMs + 1000);

            stream.on('data', (d) => raw += d.toString('utf8'));
            stream.stderr.on('data', (d) => stderr += d.toString('utf8'));

            stream.on('close', () => {
              clearTimeout(hard);
              finish('stream-close');
            });
          }
        );
      });

      conn.on('error', (e) => finish('conn-error: ' + String(e)));

      conn.connect({
        host: creds.host as string,
        port: creds.port as number,
        username: creds.username as string,
        password: creds.password as string,
      });
    });
  }
}
