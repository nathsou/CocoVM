
type bits = boolean[];

let Utils = {

    bits2num: (register: bits): number => {
        let b = '';
        for (let bit of register)
            b += bit ? '1' : '0';

        return parseInt(b, 2);
    },

    num2bits: (register: number): bits => {
        let b: bits = [];

        for (let bit of register.toString(2))
            b.push(bit === '1');

        return b;
    },

    fillZeros: (num: number | bits, count: number, backwards = false): bits => {

        let b: bits = [];

        if (typeof (num) === 'number')
            b = Utils.num2bits(num);
        else b = num;

        for (let i = b.length; i < count; i++) {
            if (!backwards) b.unshift(false);
            else b.push(false);
        }

        return b;
    },

    bits2str: (data: bits): string => {
        let str = '';

        for (let bit of data)
            str += bit ? '1' : '0';

        return str;
    },

    bits2hexstr: (data: bits): string => {

        let bin = Utils.bits2str(data);
        let hex = '';

        for (let i = 0; i < bin.length; i += 16)
            hex += parseInt(bin.substr(i, i + 16), 2).toString(16) + ' ';

        return hex;

    },

    str2bits: (data: string): bits => {
        let b: bits = [];

        for (let bit of data)
            b.push(bit === '1');

        return b;
    },

    negativeBinary: (bin: bits): bits => { //two's complement
        for (let i = 0; i < bin.length; i++)
            bin[i] = !bin[i];

        return Utils.num2bits(Utils.bits2num(bin) + 1);
    },

    xor: (a: boolean, b: boolean): boolean => {
        return (a || b) && !(a && b);
    },

    bitAdder(a: boolean, b: boolean, carry: boolean): { sum: boolean, carry: boolean } {

        let a_xor_b = Utils.xor(a, b);

        return {
            sum: Utils.xor(a_xor_b, carry),
            carry: (a_xor_b && carry) || (a && b)
        };
    },

};

interface Architecture {
    bits: number;
    registerCount: number,
    RAM_bytes: number
}

abstract class EventEmitter {

    eventHandlers: Map<string, (value) => any>;

    constructor() {
        this.eventHandlers = new Map<string, (value) => any>();
    }

    on(ev: string, handler: (value) => any) {
        this.eventHandlers.set(ev, handler);
    }

    protected emit(ev: string, value?: any) {

        if (this.eventHandlers.has(ev))
            this.eventHandlers.get(ev).call(this, value);
    }

    protected bindEvent(em: EventEmitter, ev: string) {

        em.on(ev, (value) => this.emit(ev, value));
    }
}

class RAM extends EventEmitter {

    byteLength: number;
    capacity: number;
    memory: bits[];

    constructor(byteLength: number, nb_bytes) {

        super();

        this.byteLength = byteLength;
        this.capacity = nb_bytes;

        this.clear();

    }

    read(addr: number): bits {

        if (addr >= this.capacity)
            this.emit('error', `Incorrect RAM address: ${addr}`);

        return this.memory[addr];
    }

    write(addr: number, value: bits): void {

        if (addr >= this.capacity)
            this.emit('error', `Incorrect RAM address: ${addr}`);

        if (value.length > this.byteLength)
            this.emit('error', `Cannot store ${value.length} bits of data in RAM, since 1 byte = ${this.byteLength}`);
        else if (value.length < this.byteLength)
            value = Utils.fillZeros(value, this.byteLength);

        this.memory[addr] = value;
    }

    clear(): void {
        this.memory = [];

        for (let i = 0; i < this.capacity; i++)
            this.memory[i] = [];
    }

}

class Computer extends EventEmitter {

    STEP_LIMIT = 10000;
    arch: Architecture;
    PC: number; //Program Counter -> addr of the current instruction
    IR: bits; //Instruction Register -> stores the current instruction's opcode 
    registers: bits[];
    RAM: RAM;
    running: boolean = false;

    opcodes = {
        'HLT': 0,
        'MOV%#': 1,
        'MOV%@': 2,
        'MOV@#': 3,
        'MOV@%': 4,
        'MOV%%': 5,
        'OUT%': 6,
        'OUT@': 7,
        'ADD%%': 8,
        'ADD%@': 9,
        'ADD%#': 10,
        'SUB%%': 11,
        'SUB%@': 12,
        'SUB%#': 13
    };

    status_reg = {
        'ZERO': false,
        'CARRY': false
    };
    

    constructor(arch: Architecture) {

        super();

        this.arch = arch;

        if (this.arch.registerCount < 1)
            this.emit('error', 'There must be at least two register (arch.registerCount)');

        if (this.arch.bits < 1)
            this.emit('error', 'Incorrect number of bits: ' + this.arch.bits);

        this.registers = [];

        for (let i = 0; i < arch.registerCount; i++)
            this.registers[i] = [];

        this.RAM = new RAM(arch.bits, arch.RAM_bytes);
        this.bindEvent(this.RAM, 'error');
        this.PC = 0;
    }

    private toByte(n: number) {
        return Utils.fillZeros(n, this.arch.bits);
    }

    compile(prog: string): bits {

        let binary: bits = [];

        for (let inst of prog.split('\n')) {

            inst = inst.trim();

            if (inst === '') continue;

            let l = [];
            l[0] = inst.substr(0, inst.indexOf(' ') || inst.length);
            l[1] = inst.replace(l[0], '');

            if (l[0] === '') { //no operands
                l[0] = l[1];
                l[1] = '';
            }

            //Handle the operand(s);

            let inst_name = l[0];
            let operands = [];

            for (let arg of l[1].split(',')) {

                arg = arg.trim();

                if (arg === '') continue;

                inst_name += arg[0];

                if (['%', '@', '#'].indexOf(arg[0]) === -1) {
                    this.emit('error', 'Invalid addressing mode identifier: ' + arg[0]);
                    break;
                }

                arg = arg.replace(arg[0], '');

                switch (arg[0]) {

                    case '$': //hexadecimal
                        operands.push(parseInt(arg, 16));
                        break;

                    case 'b': //binary
                        operands.push(parseInt(arg, 2));
                        break;

                    default:
                        operands.push(parseInt(arg));
                        break;

                }


            }

            let opcode = this.opcodes[inst_name];

            if (opcode !== undefined) {
                binary.push(...this.toByte(opcode));
                for (let op of operands)
                    binary.push(...this.toByte(op));
            } else this.emit('error', 'Unknown instruction: ' + opcode);

        }

        return binary;

    }

    loadProgram(prog: bits | string, addr: number): void {

        if (!(prog instanceof String)) { //bits2num

            this.PC = addr;

            for (let i = 0; i < prog.length; i += this.arch.bits) //Store program to RAM
                this.RAM.write(addr + i / this.arch.bits, prog.slice(i, i + this.arch.bits));

        } else  //string
            this.loadProgram(Utils.str2bits(prog), addr);

    }

    step(): void { //runs one clock cycle

        this.IR = this.RAM.read(this.PC);

        let opcode = Utils.bits2num(this.IR);

        let a, b;


        switch (opcode) {
            case this.opcodes['HLT']:

                this.running = false;
                break;

            case this.opcodes['MOV%%']:

                a = Utils.bits2num(this.RAM.read(this.PC + 1)),
                b = Utils.bits2num(this.RAM.read(this.PC + 2));
            

                this.setRegister(a, this.getRegister(b));

                this.PC += 3;

                break;

            case this.opcodes['MOV%#']:

                a = Utils.bits2num(this.RAM.read(this.PC + 1)),
                b = this.RAM.read(this.PC + 2);
            

                this.setRegister(a, b);

                this.PC += 3;

                break;

            case this.opcodes['MOV%@']:

                a = Utils.bits2num(this.RAM.read(this.PC + 1)),
                b = Utils.bits2num(this.RAM.read(this.PC + 2));

                this.setRegister(a, this.RAM.read(b));

                this.PC += 3;

                break;

            case this.opcodes['MOV@#']:

                a = Utils.bits2num(this.RAM.read(this.PC + 1)),
                b = this.RAM.read(this.PC + 2);

                this.PC += 3;

                this.RAM.write(a, b);

                break;

            case this.opcodes['MOV@%']:

                a = Utils.bits2num(this.RAM.read(this.PC + 1)),
                b = Utils.bits2num(this.RAM.read(this.PC + 2));

                this.RAM.write(a, this.getRegister(b));

                this.PC += 3;

                break;

            case this.opcodes['MOV%#']:

                a = Utils.bits2num(this.RAM.read(this.PC + 1)),
                b = this.RAM.read(this.PC + 2);

                this.setRegister(a, b);

                this.PC += 3;

                break;
            
            case this.opcodes['OUT%']:

                a = Utils.bits2num(this.RAM.read(this.PC + 1));

                this.emit('OUT', this.getRegister(a));

                this.PC += 2;

                break;

            case this.opcodes['OUT@']:

                a = Utils.bits2num(this.RAM.read(this.PC + 1));

                this.emit('OUT', this.RAM.read(a));

                this.PC += 2;

                break;

            case this.opcodes['ADD%#']:

                a = Utils.bits2num(this.RAM.read(this.PC + 1)),
                b = this.RAM.read(this.PC + 2);

                this.setRegister(a, this.ALU(this.getRegister(a), b));

                this.PC += 3;

                break;

            case this.opcodes['ADD%%']:

                a = Utils.bits2num(this.RAM.read(this.PC + 1)),
                b = Utils.bits2num(this.RAM.read(this.PC + 2));

                this.setRegister(a, this.ALU(this.getRegister(a), this.getRegister(b)));

                this.PC += 3;

                break;
                
            case this.opcodes['ADD%@']:

                a = Utils.bits2num(this.RAM.read(this.PC + 1)),
                b = Utils.bits2num(this.RAM.read(this.PC + 2));

                this.setRegister(a, this.ALU(this.getRegister(a), this.RAM.read(b)));

                this.PC += 3;

                break;

        }
        

        this.emit('step', this.PC);
    }

    run(clean: boolean = true): void { //runs instructions until HLT

        this.running = true;

        this.emit('run');

        let steps = 0;

        while (this.running) {
            this.step();
            if (++steps > this.STEP_LIMIT) {
                this.emit('error', 'Infinite loop detected');
                break;
            }
        }

        if (clean) this.reset(false);
    }

    getRegister(n: number): bits {

        if (n >= this.arch.registerCount)
            this.emit('error', 'Invalid register address: ' + n);

        return this.registers[n];
    }

    setRegister(n: number, value: bits): void {

        if (n >= this.arch.registerCount)
            this.emit('error', 'Invalid register address: ' + n);

        this.registers[n] = value;
    }

    reset(clearRAM: boolean = true): void {

        for (let i = 0; i < this.arch.registerCount; i++)
            this.registers[i] = [];

        if (clearRAM) this.RAM.clear();

        this.status_reg = { CARRY: false, ZERO: false };
        this.PC = 0;
        this.running = false;

        this.emit('reset');
    }

    halt(msg: string = '') {
        console.warn('Computer halted: ' + msg);
        this.running = false;

        this.emit('error', msg);
    }

    ALU(a: bits, b: bits, sub = false): bits {

        let sum: bits = [],
            carry = false;

        let m = Math.max(a.length, b.length);

        if (a.length !== m) {
            a = Utils.fillZeros(a, m);
        } else b = Utils.fillZeros(b, m);

        for (let i = m - 1; i >= 0; i--) {

            let s = Utils.bitAdder(a[i], b[i], carry);

            sum.unshift(s.sum);
            carry = s.carry;
        }

        if (carry) {
            if (sum.length < this.arch.bits) {
                sum.push(true);
            } else this.status_reg[0] = true;
        }

        return sum;

    }

}