
type bits = boolean[];

let Utils = {

    bits2num: (register: bits) : number => {
        let b = '';
        for (let bit of register) 
            b += bit ? '1' : '0';

        return parseInt(b, 2);
    },

    num2bits: (register: number) : bits => {
        let b: bits = [];

        for (let bit of register.toString(2)) 
            b.push(bit === '1');
        
        return b;
    },

    fillZeros: (num: number | bits, count: number, backwards = false) : bits => {

        let b: bits = [];

        if (typeof(num) === 'number')
            b = Utils.num2bits(num);
        else b = num;

        for (let i = b.length; i < count; i++) {
            if (!backwards) b.unshift(false);
            else b.push(false);
        }

        return b;
    },

    bits2str: (data: bits) : string => {
        let str = '';

        for (let bit of data) 
            str += bit ? '1' : '0';

        return str;
    },

    str2bits: (data: string) : bits => {
        let b: bits = [];

        for (let bit of data)
            b.push(bit === '1');

        return b;
    },

    negativeBinary: (bin: bits) : bits => { //two's complement
        for (let i = 0; i < bin.length; i++)
            bin[i] = !bin[i];

        return Utils.num2bits(Utils.bits2num(bin) + 1);
    },

    xor: (a: boolean, b: boolean) : boolean => {
        return (a || b) && !(a && b);
    },

    bitAdder(a: boolean, b: boolean, carry: boolean) : {sum: boolean, carry: boolean} {

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

        this.memory = [];

        for (let i = 0; i < nb_bytes; i++)
            this.memory[i] = [];

    }

    read(addr: number) : bits {

        if (addr >= this.capacity)
            this.emit('error', `Incorrect RAM address: ${addr}`);

        return this.memory[addr];
    }

    write(addr: number, value: bits) : void {

        if (addr >= this.capacity)
            this.emit('error', `Incorrect RAM address: ${addr}`);

        if (value.length > this.byteLength)
            this.emit('error', `Cannot store ${value.length} bits of data in RAM, since 1 byte = ${this.byteLength}`);
        else if (value.length < this.byteLength)
            value = Utils.fillZeros(value, this.byteLength);

        this.memory[addr] = value;
    }

}

class Computer extends EventEmitter {

    STEP_LIMIT = 10000;
    arch: Architecture;
    PC: number; //Program Counter -> addr of the current instruction
    registers: bits[];
    RAM: RAM;
    instructions: bits[];
    status_reg: bits;
    instCodeBitCount: number;
    running: boolean = false;

    instNames = [
        'AEQ', //AEQ v: v -> A
        'LDA', //LDA n : Load register n to A
        'STA', //STA n : Store A to register n
        'JMP', //JMP addr : Set PC to addr
        'ADD', //ADD n: value of n + value of A -> A
        'JC', //JC addr : Set PC to addr if overflow is true
        'OUT', //OUT: Output value of A
        'SUB', //SUB n: value of n - value of A -> A
        'INC', //INC n: value of n = value of n + 1
        'CMP', //
        'JNEQ', //JNEQ addr: Jump to addr if flag Z = 1
        'HLT' //HLT : Stop execution
    ];

    constructor(arch: Architecture) {

        super();

        this.arch = arch;

        if (this.arch.registerCount < 1) 
            this.emit('error', 'There must be at least one register (arch.registerCount)');

        if (this.arch.bits < 1)
            this.emit('error', 'Incorrect number of bits: ' + this.arch.bits);

        this.registers = [];

        for (let i = 0; i < arch.registerCount; i++)
            this.registers[i] = [];

        this.RAM = new RAM(arch.bits, arch.RAM_bytes);
        this.bindEvent(this.RAM, 'error');

        this.instructions = [];
        this.status_reg = [false, false]; //overflow, zero
        this.PC = 0;

        this.instCodeBitCount = Math.floor(Math.log(this.instNames.length) / Math.LN2) + 1;
    }

    compile(prog: string) : bits {

        let binary: bits = [];

        let bitsPerInst = Math.ceil((this.instCodeBitCount + 2 + this.arch.bits) / this.arch.bits) * this.arch.bits;

        
        for (let inst of prog.split('\n')) {

            //Translate the instruction into binary


            //Find current instruction's code

            inst = inst.trim();

            let instBinary = [];

            if (inst === '') continue;

            let l = inst.split(' ');

            let n = this.instNames.indexOf(l[0]);

            if (n === -1) 
                this.emit('error', 'Unknown instruction: ' + l[0]);

            instBinary.push(...Utils.fillZeros(n, this.instCodeBitCount)); //Add instruction code


            //Handle the argument

            if (l[1] === undefined) l[1] = '';

            let arg = 0; 

            instBinary.push(l[1][0] === '#'); //numerical value or RAM addr ?
            instBinary.push(l[1][0] === '%'); //register addr

            l[1] = l[1].replace('#', '').replace('%', '');

            if (l[1].substr(0, 1) === '$') { //hex
                arg = parseInt(l[1].replace('$', ''), 16);
            } else //decimal
                arg = parseInt(l[1]);


            instBinary.push(...Utils.fillZeros(arg, bitsPerInst - instBinary.length));

            
            //binary.push(...Utils.fillZeros(instBinary, bitsPerInst, true));

            binary.push(...instBinary);

        }

        return binary;

    }

    loadProgram(prog: bits | string) : void {

        if (!(prog instanceof String)) { //bits

        this.instructions = [];

        this.PC = 0;

        let instLen =  Math.ceil((this.instCodeBitCount + 2 + this.arch.bits) / this.arch.bits) * this.arch.bits;

        for (let i = 0; i < prog.length; i += instLen)
            this.instructions.push(prog.slice(i, i + instLen));

        } else  //string
            this.loadProgram(Utils.str2bits(prog));

    }

    step() : void { //runs one clock cycle

        if (this.PC >= this.instructions.length) {
            this.emit('error', 'No instruction at addr: ' + this.PC.toString(16))
        }

        let inst = this.instructions[this.PC];

        let icode = Utils.bits2num(inst.slice(0, this.instCodeBitCount));
        
        let argBin = inst.slice(this.instCodeBitCount + 2, inst.length);
        let arg = Utils.bits2num(argBin);

        if (!inst[this.instCodeBitCount]) { //arg is a RAM address
            argBin = this.RAM.read(arg);
            arg = Utils.bits2num(argBin);
        } else if (inst[this.instCodeBitCount + 1]) { //arg is a register address
            argBin = this.getRegister(arg);
            arg = Utils.bits2num(argBin);  
        }



        switch (icode) {
            case 0: //AEQ

                this.setRegister(0, argBin);

                this.PC++;

                break;

            case 1: //LDA


                this.setRegister(0, argBin);

                this.PC++;

                break;

            case 2: //STA 

                this.setRegister(arg, this.getRegister(0));

                this.PC++;

                break;

            case 3: //JMP

                this.PC = arg;

                break;

            case 4: //ADD

                this.setRegister(0, this.ALU(this.getRegister(0), argBin));

                this.PC++;

                break;

            case 5: //JC

                if (this.status_reg[0])
                    this.PC = arg;
                else this.PC++;

                break;

            case 6: //OUT

                this.emit('OUT', `${Utils.bits2str(this.getRegister(0))} - ${Utils.bits2num(this.getRegister(0))}`);

                this.PC++;

                break;

            case 7: //SUB

                //TODO

                break;

            case 8: //INC

                this.registers[arg] = this.ALU(this.registers[arg], [true]);

                this.PC++;

                break;

            case 9: //CMP

                this.status_reg[1] = Utils.bits2num(this.getRegister(0)) === arg;

                this.PC++;

                break;

            case 10: //JNEQ

                if (!this.status_reg[1]) {
                    this.PC = arg;
                } else this.PC++;

                break;

            case 11: //HLT

                this.running = false;

                break;
        }

        this.emit('step', this.PC);
    }

    run(clean: boolean = true) : void { //runs instructions until HLT

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

    getRegister(n: number) : bits {

        if (n >= this.arch.registerCount)
            this.emit('error', 'Invalid register address: ' + n);

        return this.registers[n];
    }

    setRegister(n: number, value: bits) : void {

        if (n >= this.arch.registerCount)
            this.emit('error', 'Invalid register address: ' + n);

        this.registers[n] = value;
    }

    reset(cleanInstructions: boolean = true) : void {

        for (let i = 0; i < this.arch.registerCount; i++) 
            this.registers[i] = [];

        if (cleanInstructions) this.instructions = [];

        this.status_reg = [false, false];
        this.PC = 0;
        this.running = false;

        this.emit('reset');
    }

    halt(msg: string = '') {
        console.warn('Computer halted: ' + msg);
        this.running = false;

        this.emit('halt', msg);
    }

    ALU(a: bits, b: bits, sub = false) : bits {

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