/// <reference path="EventEmitter.ts" />


class Memory extends EventEmitter {

    byteLength: number;
    capacity: number;
    name: string;
    memory: Map<string, byte>;
    private zero: byte;

    constructor(name = 'memory', byteLength: number, nb_bytes) {

        super();

        this.name = name;

        this.byteLength = byteLength;
        this.capacity = nb_bytes;

        this.zero = Utils.fillZeros(0, byteLength);

        this.memory = new Map<string, byte>();

        this.clear();

    }

    read(addr: byte | string): bits {

        if (addr instanceof Array)
            addr = Utils.bits2str(addr);

        if (addr.length > this.byteLength)
            this.emit('error', `Incorrect ${this.name} address: ${addr}`);

            if (this.memory.get(addr) === undefined)
                return this.zero.slice();

        return this.memory.get(addr);
    }

    write(addr: byte | string, value: bits): void {

        if (addr instanceof Array)
            addr = Utils.bits2str(addr);

        if (addr.length > this.byteLength)
            this.emit('error', `Incorrect ${this.name} address: ${addr}`);

        if (value.length > this.byteLength)
            this.emit('error', `Cannot store ${value.length} bits of data in ${this.name}, since 1 byte = ${this.byteLength}`);
        else
            this.memory.set(addr, Utils.fillZeros(value, this.byteLength));

    }

    clear(): void {
        this.memory.clear();
    }

}