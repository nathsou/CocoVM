
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

    fillZeros: (num: number | bits, count: number) : bits => {

        let b: bits = [];

        if (typeof(num) === 'number')
            b = Utils.num2bits(num);
        else b = num;

        for (let i = b.length; i < count; i++)
            b.unshift(false);

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
    registerCount: number
}

class Computer {

    STEP_LIMIT = 10000;
    arch: Architecture;
    instAddr: number;
    registers: bits[];
    instructions: bits[];
    status_reg: bits;
    instCodeBitCount: number;
    running: boolean = false;
    eventHandlers: Map<string, (value) => any>;

    instNames = [
        'AEQ', //AEQ v: v -> A
        'LDA', //LDA n : Load register n to A
        'STA', //STA n : Store A to register n
        'JMP', //JMP addr : Set instAddr to addr
        'ADD', //ADD n: value of n + value of A -> A
        'JC', //JC addr : Set instAddr to addr if overflow is true
        'OUT', //OUT: Output value of A
        'SUB', //SUB n: value of n - value of A -> A
        'INC', //INC n: value of n = value of n + 1
        'CMP', //
        'JNEQ', //JNEQ addr: Jump to addr if flag Z = 1
        'HLT' //HLT : Stop execution
    ];

    constructor(arch: Architecture) {
        this.arch = arch;

        if (this.arch.registerCount < 1) 
            this.emit('error', 'There must be at least one register (arch.registerCount)');

        if (this.arch.bits < 1)
            this.emit('error', 'Incorrect number of bits: ' + this.arch.bits);

        this.registers = [];

        for (let i = 0; i < arch.registerCount; i++)
            this.registers[i] = [];

        this.instructions = [];
        this.status_reg = [false, false]; //overflow, zero
        this.instAddr = 0;
        this.eventHandlers = new Map<string, (value) => any>();

        this.instCodeBitCount = Math.floor(Math.log(this.instNames.length) / Math.LN2) + 1;
    }

    compile(prog: string) : bits {

        let binary: bits = [];

        
        for (let inst of prog.split('\n')) {

            if (inst.trim() === '') continue;

            let l = inst.trim().split(' ');

            let n = null;

            for (let i = 0; i < this.instNames.length; i++) {
                if (this.instNames[i] === l[0])
                    n = i; 
            }

            if (n === null) {
                this.emit('error', 'Unknown instruction: ' + l[0]);
            }

            
            for (let bit of Utils.fillZeros(n, this.instCodeBitCount)) //Add instruction code
                binary.push(bit);

            if (l[1] === undefined) {
                for (let i = 0; i < this.arch.bits; i++)
                    binary.push(false);

                continue;
            }

            //convert the argument to hex

            let arg = 0; 

            if (l[1].substr(0, 1) === '$') { //hex
                arg = parseInt(l[1].replace('$', ''), 16);
            } else //decimal
                arg = parseInt(l[1]);

            for (let bit of Utils.fillZeros(arg, this.arch.bits))
                binary.push(bit);

        }

        return binary;

    }

    loadProgram(prog: bits | string) : void {

        if (!(prog instanceof String)) { //bits

        this.instructions = [];

        this.instAddr = 0;

        let instLen = this.instCodeBitCount + this.arch.bits;

        for (let i = 0; i < prog.length; i += instLen)
            this.instructions.push(prog.slice(i, i + instLen));

        } else  //string
            this.loadProgram(Utils.str2bits(prog));

    }

    step() : void { //runs one clock cycle

        if (this.instAddr >= this.instructions.length) {
            this.emit('error', 'No instruction at addr: ' + this.instAddr.toString(16))
        }

        let inst = this.instructions[this.instAddr];

        let icode = Utils.bits2num(inst.slice(0, this.instCodeBitCount));
        let argBin = inst.slice(this.instCodeBitCount, inst.length);
        let arg = Utils.bits2num(argBin);

        switch (icode) {
            case 0: //AEQ

                this.setRegister(0, argBin);

                this.instAddr++;

                break;

            case 1: //LDA


                this.setRegister(0, this.getRegister(arg));

                this.instAddr++;

                break;

            case 2: //STA 

                this.setRegister(arg, this.getRegister(0));

                this.instAddr++;

                break;

            case 3: //JMP

                this.instAddr = arg;

                break;

            case 4: //ADD

                this.setRegister(0, this.ALU(this.getRegister(0), this.getRegister(arg)));

                this.instAddr++;

                break;

            case 5: //JC

                if (this.status_reg[0])
                    this.instAddr = arg;
                else this.instAddr++;

                break;

            case 6: //OUT

                this.emit('OUT', `${Utils.bits2str(this.getRegister(0))} - ${Utils.bits2num(this.getRegister(0))}`);

                this.instAddr++;

                break;

            case 7: //SUB

                //TODO

                break;

            case 8: //INC

                this.registers[arg] = this.ALU(this.registers[arg], [true]);

                this.instAddr++;

                break;

            case 9: //CMP

                this.status_reg[1] = Utils.bits2num(this.getRegister(0)) === arg;

                this.instAddr++;

                break;

            case 10: //JNEQ

                if (!this.status_reg[1]) {
                    this.instAddr = arg;
                } else this.instAddr++;

                break;

            case 11: //HLT

                this.running = false;

                break;
        }

        this.emit('step', this.instAddr);
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
        this.instAddr = 0;
        this.running = false;

        this.emit('reset');
    }

    halt(msg: string = '') {
        console.warn('Computer halted: ' + msg);
        this.running = false;

        this.emit('halt');
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

    on(ev: string, handler: (value) => any) {

        this.eventHandlers.set(ev, handler);

    } 

    protected emit(ev: string, value?: any) {

        if (this.eventHandlers.has(ev))
            this.eventHandlers.get(ev).call(this, value);
    }
    

}