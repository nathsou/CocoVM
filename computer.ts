
let Utils = {

    bool2num: (register: boolean[]) : number => {
        let b = '';
        for (let bit of register) 
            b += bit ? '1' : '0';

        return parseInt(b, 2);
    },

    num2bool: (register: number) : boolean[] => {
        let b: boolean[] = [];

        for (let bit of register.toString(2)) 
            b.push(bit === '1');
        
        return b;
    },

    fillZeros: (num: number | boolean[], count: number) : boolean[] => {

        let b: boolean[] = [];

        if (typeof(num) === 'number')
            b = Utils.num2bool(num);
        else b = num;

        for (let i = b.length; i < count; i++)
            b.unshift(false);

        return b;
    },

    bits2str: (data: boolean[]) : string => {
        let str = '';

        for (let bit of data) 
            str += bit ? '1' : '0';

        return str;
    },

    str2bits: (data: string) : boolean[] => {
        let b: boolean[] = [];

        for (let bit of data)
            b.push(bit === '1');

        return b;
    },

    negativeBinary: (bin: boolean[]) : boolean[] => { //two's complement
        for (let i = 0; i < bin.length; i++)
            bin[i] = !bin[i];

        return Utils.num2bool(Utils.bool2num(bin) + 1);
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
}

class Computer {

    STEP_LIMIT = 10000;
    arch: Architecture;
    instAddr: number;
    registers: boolean[][];
    instructions: boolean[][];
    accumulator: boolean[];
    status_reg: boolean[];
    instCodeBitCount: number;
    running: boolean = false;

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

        this.registers = [];

        for (let i = 0; i < arch.registerCount; i++) {
            this.registers[i] = [];
        }

        this.instructions = [];
        this.accumulator = [];
        this.status_reg = [false, false]; //overflow, zero
        this.instAddr = 0;

        this.instCodeBitCount = Math.floor(Math.log(this.instNames.length) / Math.LN2) + 1;
    }

    compile(prog: string) : boolean[] {

        let binary: boolean[] = [];

        
        for (let inst of prog.split('\n')) {

            if (inst.trim() === '') continue;

            let l = inst.trim().split(' ');

            let n = null;

            for (let i = 0; i < this.instNames.length; i++) {
                if (this.instNames[i] === l[0])
                    n = i; 
            }

            if (n === null) {
                alert('Unknown instruction: ' + l[0]);
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

            if (l[1].substr(0, 2) === '0x') { //hex
                arg = parseInt(l[1]);
            } else if (l[1][l[1].length - 1] === 'd') { //decimal
                arg = parseInt(l[1].replace('d', ''));
            } else { //binary
                arg = parseInt(l[1], 2);
            }

            for (let bit of Utils.fillZeros(arg, this.arch.bits))
                binary.push(bit);

        }

        return binary;

    }

    loadProgram(prog: boolean[] | string) : void {

        if (!(prog instanceof String)) { //boolean[]

        this.instructions = [];

        this.instAddr = 0;

        let instLen = this.instCodeBitCount + this.arch.bits;

        for (let i = 0; i < prog.length; i += instLen)
            this.instructions.push(prog.slice(i, i + instLen));

        } else  //string
            this.loadProgram(Utils.str2bits(prog));

    }

    step() : void { //runs one clock cycle

        if (this.instAddr > this.instructions.length) {
            alert('No instruction at addr: ' + this.instAddr.toString(16));
        }

        let inst = this.instructions[this.instAddr];

        let icode = Utils.bool2num(inst.slice(0, this.instCodeBitCount));
        let argBin = inst.slice(this.instCodeBitCount, inst.length);
        let arg = Utils.bool2num(argBin);

        switch (icode) {
            case 0: //AEQ

                this.accumulator = argBin;

                this.instAddr++;

                break;

            case 1: //LDA

                this.accumulator = this.registers[arg];

                this.instAddr++;

                break;

            case 2: //STA 

                this.registers[arg] = this.accumulator;

                this.instAddr++;

                break;

            case 3: //JMP

                this.instAddr = arg;

                break;

            case 4: //ADD

                this.accumulator = this.ALU(this.accumulator, this.registers[arg]);

                this.instAddr++;

                break;

            case 5: //JC

                if (this.status_reg[0])
                    this.instAddr = arg;
                else this.instAddr++;

                break;

            case 6: //OUT

                console.info(Utils.bits2str(this.accumulator) + ' - ' + Utils.bool2num(this.accumulator));

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

                this.status_reg[1] = Utils.bool2num(this.accumulator) === arg;

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
    }

    run(clean: boolean = true) : void { //runs instructions until HLT

        this.running = true;
        let steps = 0;

        while (this.running) {
            this.step();
            if (++steps > this.STEP_LIMIT) {
                alert('Infinite loop detected');
                break;
            }
        }

        if (clean) this.reset(false);
    }

    setRegister(n: number, value: boolean[]) : void {
        this.registers[n] = value;
    }

    reset(cleanInstructions: boolean = true) : void {

        for (let i = 0; i < this.arch.registerCount; i++) {
            this.registers[i] = [];
        }

        this.accumulator = [];

        if (cleanInstructions) this.instructions = [];

        this.status_reg = [false, false];
        this.instAddr = 0;
        this.running = false;
    }

    halt(msg: string = '') {
        console.warn('Computer halted: ' + msg);
        this.running = false;
    }

    ALU(a: boolean[], b: boolean[], sub = false) : boolean[] {

        let sum: boolean[] = [],
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
            if (sum.length < this.arch.bits) {
                sum.push(true);
            } else this.status_reg[0] = true;
        }

        return sum;

    }
    

}