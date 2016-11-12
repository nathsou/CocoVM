
type bit = boolean;
type bits = bit[];
type byte = bits;

let Utils = {

    byte2num: (a: bits, byteLength: number): number => { //Using two's complement

        let b = '';
        for (let i = 1; i < a.length; i++)
            b += a[i] ? '1' : '0';

        let val = parseInt(b, 2);

        if (!a[0]) return val; //it's positive

        //it's negative

        return val - (1 << (byteLength - 1));
    },

    num2byte: (a: number, byteLength: number): bits => {
        let b: bits = [];

        for (let bit of Math.abs(a).toString(2))
            b.push(bit === '1');

        b = Utils.fillZeros(b, byteLength);

        if (a < 0) {

            let neg = '';

            for (let bit of b) 
                neg += bit ? '0' : '1';
            
            return Utils.str2bits(((parseInt(neg, 2) + 1).toString(2)));
        }

        return b;
    },

    fillZeros: (num: number | bits, count: number, backwards = false): bits => {

        let b: bits = [];

        if (typeof (num) === 'number')
            b = Utils.num2byte(num, count);
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

        let fillHex = (hex: string): string => {
            for (let i = 0; i < 4 - hex.length; i++)
                hex = '0' + hex;

            return hex;
        };

        for (let i = 0; i < bin.length; i += 16)
            hex += fillHex(parseInt(bin.substr(i, 16), 2).toString(16)) + ' ';

        return hex;

    },

    bytesEQU: (a: byte, b: byte) : boolean => {

        if (a.length !== b.length) return false;

        for (let i = 0; i < a.length; i++)
            if (a[i] !== b[i]) return false

        return true;
    } ,

    str2bits: (data: string): bits => {
        let b: bits = [];

        for (let bit of data)
            b.push(bit === '1');

        return b;
    },

    xor: (a: boolean, b: boolean): boolean => {
        return (a || b) && !(a && b);
    },

    necessaryBitCount: (n: number): number => {
        if (n === 0) return 1;
        return Math.floor(Math.log2(n)) + 1;
    }

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

            if (this.memory[addr].length === 0)
                return Utils.fillZeros(0, this.byteLength);

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

    STEP_LIMIT = 100000;
    arch: Architecture;
    PC: number; //Program Counter -> addr of the current instruction
    IR: bits; //Instruction Register -> stores the current instruction's opcode 
    registers: bits[];
    RAM: RAM;
    ALU: ALU;
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
        'SUB%#': 13,
        'INC%': 14,
        'CMP%%': 15,
        'CMP%@': 16,
        'CMP%#': 17,
        'JMP%': 18, //unconditional jump
        'JMP!': 19,
        'JC%': 20, //jump if carry flag is true
        'JC!': 21,
        'JNC%': 22, //jump if carry flag is false
        'JNC!': 23,
        'JZ%': 24, //jump if zero flag is true
        'JZ!': 25,
        'JEQ%': 20, //jump if equal
        'JEQ!': 21,
        'JNZ%': 26, //jump if zero flag is false
        'JNZ!': 27,
        'JNEQ%': 22, //jump if not equal
        'JNEQ!': 28,
        'DEC%': 29,
        'JGTR%': 30,
        'JGTR!': 31,
        'JNGTR%': 32,
        'JNGTR!': 33,
        'JLSS%': 32,
        'JLSS!': 33
    };

    status_reg = {
        'ZERO': false,
        'CARRY': false,
        'SIGN': false
    };
    

    constructor(arch: Architecture) {

        super();
        
        this.arch = arch;

        if (this.arch.registerCount < 1)
            this.emit('error', 'There must be at least two registers (arch.registerCount)');

        if (this.arch.bits < 1)
            this.emit('error', 'Incorrect byte length: ' + this.arch.bits);

        this.registers = [];

        for (let i = 0; i < arch.registerCount; i++)
            this.registers[i] = [];

        this.RAM = new RAM(arch.bits, arch.RAM_bytes);
        this.bindEvent(this.RAM, 'error');
        this.PC = 0;
        this.ALU = new ALU(this);
    }

    private toByte(n: number) {
        return Utils.fillZeros(Utils.num2byte(n, this.arch.bits), this.arch.bits);
    }

    compile(prog: string): bits {

        let binary: bits = [];

        let instructions = [];

        let labels = new Map<string, number>();

        //Remove comments and blank lines & identify labels
        for (let inst of prog.split('\n')) {

            inst = inst.trim();

            if (inst === '' || inst[0] === ';') continue;

            let label: string[];

            if ((label = /^[.A-Za-z]\w*:$/.exec(inst)) !== null) {
                labels.set(label[0].replace(':', ''), instructions.length);
            } else instructions.push(inst);

        }

        //assemble instructions

        //       3 bytes
        // <----------------->   
        //   1 byte - 2 bytes
        // <-------><-------> 
        // |OP CODE|ARG1|ARG2|

        for (let i = 0; i < instructions.length; i++) {

            let inst = instructions[i];

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


                //replace labels with relative address
                let label;

                if ((label = /^[.A-Za-z]\w*$/.exec(arg)) !== null) {
                    label = label[0];

                    if (labels.has(label)) {
                        let relative = labels.get(label) - i;
                        arg = `!${relative}`;
                    } else this.emit('error', `Label not foud: ${label}`)
                }

                inst_name += arg[0];

                if (['%', '@', '#', '!'].indexOf(arg[0]) === -1) {
                    this.emit('error', 'Invalid addressing mode identifier: ' + arg[0]);
                    break;
                }

                let val = 0;

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
                for (let i = 0; i < 2; i++) {
                    if (i < operands.length)
                        binary.push(...this.toByte(operands[i]));
                    else binary.push(...this.toByte(0));
                }
            } else this.emit('error', 'Unknown instruction: ' + inst_name);
            

        }

        return binary;

    }

    loadProgram(prog: bits | string, addr: number): void {

        if (!(prog instanceof String)) { //byte2num

            for (let i = 0; i < prog.length; i += this.arch.bits) //Store program to RAM
                this.RAM.write(addr + i / this.arch.bits, prog.slice(i, i + this.arch.bits));

        } else  //string
            this.loadProgram(Utils.str2bits(prog), addr);

    }

    byte2num(a: byte) : number {
        return Utils.byte2num(a, this.arch.bits);
    }

    step(): void { //runs one clock cycle

        this.IR = this.RAM.read(this.PC);

        let opcode = this.byte2num(this.IR);
        let a, b;


        switch (opcode) {
            case this.opcodes['HLT']:

                this.running = false;
                break;

            case this.opcodes['MOV%%']:

                a = this.byte2num(this.RAM.read(this.PC + 1)),
                b = this.byte2num(this.RAM.read(this.PC + 2));
            

                this.setRegister(a, this.getRegister(b));

                this.PC += 3;

                break;

            case this.opcodes['MOV%#']:

                a = this.byte2num(this.RAM.read(this.PC + 1)),
                b = this.RAM.read(this.PC + 2);
            

                this.setRegister(a, b);

                this.PC += 3;

                break;

            case this.opcodes['MOV%@']:

                a = this.byte2num(this.RAM.read(this.PC + 1)),
                b = this.byte2num(this.RAM.read(this.PC + 2));

                this.setRegister(a, this.RAM.read(b));

                this.PC += 3;

                break;

            case this.opcodes['MOV@#']:

                a = this.byte2num(this.RAM.read(this.PC + 1)),
                b = this.RAM.read(this.PC + 2);

                this.PC += 3;

                this.RAM.write(a, b);

                break;

            case this.opcodes['MOV@%']:

                a = this.byte2num(this.RAM.read(this.PC + 1)),
                b = this.byte2num(this.RAM.read(this.PC + 2));

                this.RAM.write(a, this.getRegister(b));

                this.PC += 3;

                break;

            case this.opcodes['MOV%#']:

                a = this.byte2num(this.RAM.read(this.PC + 1)),
                b = this.RAM.read(this.PC + 2);

                this.setRegister(a, b);

                this.PC += 3;

                break;
            
            case this.opcodes['OUT%']:

                a = this.byte2num(this.RAM.read(this.PC + 1));

                this.emit('OUT', this.getRegister(a));

                this.PC += 3;

                break;

            case this.opcodes['OUT@']:

                a = this.byte2num(this.RAM.read(this.PC + 1));

                this.emit('OUT', this.RAM.read(a));

                this.PC += 3;

                break;

            case this.opcodes['ADD%#']:

                a = this.byte2num(this.RAM.read(this.PC + 1)),
                b = this.RAM.read(this.PC + 2);

                this.setRegister(a, this.ALU.add(this.getRegister(a), b));

                this.PC += 3;

                break;

            case this.opcodes['ADD%%']:

                a = this.byte2num(this.RAM.read(this.PC + 1)),
                b = this.byte2num(this.RAM.read(this.PC + 2));

                this.setRegister(a, this.ALU.add(this.getRegister(a), this.getRegister(b)));

                this.PC += 3;

                break;
                
            case this.opcodes['ADD%@']:

                a = this.byte2num(this.RAM.read(this.PC + 1)),
                b = this.byte2num(this.RAM.read(this.PC + 2));

                this.setRegister(a, this.ALU.add(this.getRegister(a), this.RAM.read(b)));

                this.PC += 3;

                break;

            case this.opcodes['SUB%#']:

                a = this.byte2num(this.RAM.read(this.PC + 1)),
                b = this.RAM.read(this.PC + 2);

                this.setRegister(a, this.ALU.sub(this.getRegister(a), b));

                this.PC += 3;

                break;

             case this.opcodes['SUB%%']:

                a = this.byte2num(this.RAM.read(this.PC + 1)),
                b = this.byte2num(this.RAM.read(this.PC + 2));

                this.setRegister(a, this.ALU.sub(this.getRegister(a), this.getRegister(b)));

                this.PC += 3;

                break;
                
            case this.opcodes['SUB%@']:

                a = this.byte2num(this.RAM.read(this.PC + 1)),
                b = this.byte2num(this.RAM.read(this.PC + 2));

                this.setRegister(a, this.ALU.sub(this.getRegister(a), this.RAM.read(b)));

                this.PC += 3;

                break; 

            case this.opcodes['INC%']:

                a = this.byte2num(this.RAM.read(this.PC + 1));

                this.setRegister(a, this.ALU.add(this.getRegister(a), [true]));

                this.PC += 3;

                break;

            case this.opcodes['DEC%']:

                a = this.byte2num(this.RAM.read(this.PC + 1));

                this.setRegister(a, this.ALU.sub(this.getRegister(a), [true]));

                this.PC += 3;

                break;

            case this.opcodes['CMP%%']:

                a = this.byte2num(this.RAM.read(this.PC + 1)),
                b = this.byte2num(this.RAM.read(this.PC + 2));

                this.ALU.sub(this.getRegister(a), this.getRegister(b));

                this.PC += 3;

                break;

            case this.opcodes['CMP%@']:

                a = this.byte2num(this.RAM.read(this.PC + 1)),
                b = this.byte2num(this.RAM.read(this.PC + 2));

                this.ALU.sub(this.getRegister(a), this.RAM.read(b));

                this.PC += 3;

                break;

            case this.opcodes['CMP%#']:

                a = this.byte2num(this.RAM.read(this.PC + 1)),
                b = this.RAM.read(this.PC + 2);

                this.ALU.sub(this.getRegister(a), b);

                let c = Utils.byte2num(b, 16);

                this.PC += 3;

                break;

            case this.opcodes['JMP%']:

                a = this.byte2num(this.RAM.read(this.PC + 1));

                this.PC = a;

                break;

            case this.opcodes['JMP!']:

                a = this.byte2num(this.RAM.read(this.PC + 1));

                this.PC += 3 * a;

                break;

            case this.opcodes['JC%']:

                a = this.byte2num(this.RAM.read(this.PC + 1));

                if (this.status_reg.CARRY) this.PC = a;
                else this.PC += 3;

                break;

            case this.opcodes['JC!']:

                a = this.byte2num(this.RAM.read(this.PC + 1));

                if (this.status_reg.CARRY) this.PC += 3 * a;
                else this.PC += 3;

                break;

            case this.opcodes['JNC%']:

                a = this.byte2num(this.RAM.read(this.PC + 1));

                if (!this.status_reg.CARRY) this.PC = a;
                else this.PC += 3;

                break;

            case this.opcodes['JNC!']:

                a = this.byte2num(this.RAM.read(this.PC + 1));

                if (!this.status_reg.CARRY) this.PC += 3 * a;
                else this.PC += 3;

                break;

            case this.opcodes['JEQ%']:

                a = this.byte2num(this.RAM.read(this.PC + 1));

                if (this.status_reg.ZERO) this.PC = a;
                else this.PC += 3;

                break;

            case this.opcodes['JEQ!']:

                a = this.byte2num(this.RAM.read(this.PC + 1));

                if (this.status_reg.ZERO) this.PC += 3 * a;
                else this.PC += 3;

                break;

            case this.opcodes['JNEQ%']:

                a = this.byte2num(this.RAM.read(this.PC + 1));

                if (!this.status_reg.ZERO) this.PC = a;
                else this.PC += 3;

                break;

            case this.opcodes['JNEQ!']:

                a = this.byte2num(this.RAM.read(this.PC + 1));

                if (!this.status_reg.ZERO) this.PC += 3 * a;
                else this.PC += 3;

                break;

            case this.opcodes['JGTR%']:

                a = this.byte2num(this.RAM.read(this.PC + 1));

                if (!this.status_reg.SIGN) this.PC = a;
                else this.PC += 3;

                break;

            case this.opcodes['JGTR!']:

                a = this.byte2num(this.RAM.read(this.PC + 1));

                if (!this.status_reg.SIGN) this.PC += 3 * a;
                else this.PC += 3;

                break;

            case this.opcodes['JLSS%']:

                a = this.byte2num(this.RAM.read(this.PC + 1));

                if (this.status_reg.SIGN) this.PC = a;
                else this.PC += 3;

                break;

            case this.opcodes['JLSS!']:

                a = this.byte2num(this.RAM.read(this.PC + 1));

                if (this.status_reg.SIGN) this.PC += 3 * a;
                else this.PC += 3;

                break;
        }

        
        

        this.emit('step', this.PC);
    }

    run(addr: number, clean: boolean = true): void { //runs instructions until HLT

        this.PC = addr;

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

        if (clean) this.reset(true);
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

        this.status_reg = { CARRY: false, ZERO: false, SIGN: false };
        this.PC = 0;
        this.IR = [];
        this.running = false;

        this.emit('reset');
    }

    halt(msg: string = '') {
        console.warn('Computer halted: ' + msg);
        this.running = false;

        this.emit('error', msg);
    }


}

class ALU { //Arithmetic-logic unit

    private computer: Computer;

    constructor(computer: Computer) {
        this.computer = computer;
    }

    //Arithmetic

    //1 bit full adder
    bitAdder(a: bit, b: bit, carry: bit): { sum: bit, carry: bit } { 

        let a_xor_b = this.xor(a, b);

        return {
            sum: this.xor(a_xor_b, carry),
            carry: (a_xor_b && carry) || (a && b)
        };
    }

    add(a: byte, b: byte) : byte {

        let sum: bits = [],
            carry = false;

        let m = Math.max(a.length, b.length);

        if (a.length !== m) {
            a = Utils.fillZeros(a, m);
        } else b = Utils.fillZeros(b, m);

        for (let i = m - 1; i >= 0; i--) {

            let s = this.bitAdder(a[i], b[i], carry);

            sum.unshift(s.sum);
            carry = s.carry;
        }

    
        //CARRY FLAG
        if (carry) {
            if (sum.length < this.computer.arch.bits) {
                sum.push(true);
            } else {
                let c = true;
                for (let i = 1; i < sum.length; i++) {
                    if (!sum[i]) c = false;
                    break
                }

                this.computer.status_reg.CARRY = c;

            }
        }


        sum = Utils.fillZeros(sum, this.computer.arch.bits);

        //ZERO FLAG
        let EQU_ZERO = true;

        for (let bit of sum) {
            if (bit) {
                EQU_ZERO = false;
                break;
            }
        }
        
        this.computer.status_reg.ZERO = EQU_ZERO;


        //SIGN FLAG

        this.computer.status_reg.SIGN = sum[0];


        return sum;
    }

    complement(a: byte) : byte {

        let copy = a.slice();

        for (let i = 0; i < a.length; i++)
            copy[i] = !copy[i];

        return Utils.fillZeros(copy, this.computer.arch.bits);
    }

    negate(a: byte) : byte { //negate (two's complement)

        return this.add(this.complement(Utils.fillZeros(a, this.computer.arch.bits)), [true]); //complement and add 1
    }

    sub(a: byte, b: byte) : byte {
        return this.add(a, this.negate(b));
    }

    //Logic

    not(a: bit) : bit {
        return !a;
    }

    and(a: bit, b: bit) : bit {
        return a && b;
    }

    or(a: bit, b: bit) : bit {
        return a || b;
    }

    nand(a: bit, b: bit) : bit {
        return !(a && b);
    }

    nor(a: bit, b: bit) : bit {
        return !(a || b);
    }

    xor(a: bit, b: bit) : bit {
        return (a || b) && !(a && b);
    }
}