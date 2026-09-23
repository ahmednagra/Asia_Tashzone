/** Minimal types for react-native-zeroconf 0.14 (the package ships none); only the calls the app uses. */
declare module 'react-native-zeroconf' {
  export interface ZeroconfService {
    name: string;
    fullName?: string;
    host?: string;
    port: number;
    addresses?: string[];
    txt?: Record<string, string>;
  }
  export type ZeroconfImplType = 'NSD' | 'DNSSD';
  export default class Zeroconf {
    scan(type?: string, protocol?: string, domain?: string, implType?: ZeroconfImplType): void;
    stop(implType?: ZeroconfImplType): void;
    publishService(type: string, protocol: string, domain: string, name: string, port: number, txt?: Record<string, string>, implType?: ZeroconfImplType): void;
    unpublishService(name: string, implType?: ZeroconfImplType): void;
    on(event: 'resolved', listener: (service: ZeroconfService) => void): this;
    on(event: 'remove', listener: (name: string) => void): this;
    on(event: 'error', listener: (error: unknown) => void): this;
    removeListener(event: 'resolved', listener: (service: ZeroconfService) => void): this;
    removeListener(event: 'remove', listener: (name: string) => void): this;
    removeListener(event: 'error', listener: (error: unknown) => void): this;
  }
}
