/// <reference path="Utils.ts" />
/// <reference path="Memory.ts" />
/// <reference path="ALU.ts" />
/// <reference path="Architecture.ts" />
/// <reference path="EventEmitter.ts" />

class Cpu extends EventEmitter {

    STEP_LIMIT = 100000;
    arch: Architecture;
    PC: bits; //Program Counter -> addr of the current instruction
    IR: bits; //Instruction Register -> stores the current instruction's opcode 
    registers: Memory;
    RAM: Memory;
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
        'JNE%': 22, //jump if not equal
        'JNE!': 28,
        'DEC%': 29,
        'JGTR%': 30,
        'JGTR!': 31,
        'JNGTR%': 32,
        'JNGTR!': 33,
        'JLSS%': 32,
        'JLSS!': 33,
        'MUL%%': 34,
        'MUL%@': 35,
        'MUL%#': 36
    };

    status_reg = {
        'ZERO': false,
        'CARRY': false,
        'SIGN': false
    };
    

    constructor(arch: Architecture) {

        super();
        
        this.arch = arch;

        if (this.arch.register_count < 1)
            this.emit('error', 'There must be at least two registers (arch.registerCount)');

        if (this.arch.bits < 1)
            this.emit('error', 'Incorrect byte length: ' + this.arch.bits);

        //Memory
        this.registers = new Memory('register', arch.bits, arch.register_count);
        this.RAM = new Memory('RAM', arch.bits, arch.RAM_bytes);

        this.bindEvent(this.registers, 'error');
        this.bindEvent(this.RAM, 'error');

        this.PC = [];
        this.IR = [];
    }

    private toByte(n: number | bits) {

        if (n instanceof Array)
            return Utils.fillZeros(n, this.arch.bits);

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

            let c = Utils.num2byte(addr, this.arch.bits);

            for (let i = 0; i < prog.length; i += this.arch.bits) { //Store program to RAM
                this.RAM.write(c, prog.slice(i, i + this.arch.bits));
                c = ALU.increment(c);
            }

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

                a = this.RAM.read(ALU.increment(this.PC)),
                b = this.RAM.read(ALU.add(this.PC, [true, false]));
            

                this.setRegister(a, this.getRegister(b));

                this.jump(1);

                break;

            case this.opcodes['MOV%#']:

                a = this.RAM.read(ALU.increment(this.PC)),
                b = this.RAM.read(ALU.add(this.PC, [true, false]));
            

                this.setRegister(a, b);

                this.jump(1);

                break;

            case this.opcodes['MOV%@']:

                a = this.RAM.read(ALU.increment(this.PC)),
                b = this.RAM.read(ALU.add(this.PC, [true, false]));

                this.setRegister(a, this.RAM.read(b));

                this.jump(1);

                break;

            case this.opcodes['MOV@#']:

                a = this.RAM.read(ALU.increment(this.PC)),
                b = this.RAM.read(ALU.add(this.PC, [true, false]));

                this.jump(1);

                this.RAM.write(a, b);

                break;

            case this.opcodes['MOV@%']:

                a = this.RAM.read(ALU.increment(this.PC)),
                b = this.RAM.read(ALU.add(this.PC, [true, false]));

                this.RAM.write(a, this.getRegister(b));

                this.jump(1);

                break;

            case this.opcodes['MOV%#']:

                a = this.RAM.read(ALU.increment(this.PC)),
                b = this.RAM.read(ALU.add(this.PC, [true, false]));

                this.setRegister(a, b);

                this.jump(1);

                break;
            
            case this.opcodes['OUT%']:

                a = this.RAM.read(ALU.increment(this.PC));

                this.emit('OUT', this.getRegister(a));

                this.jump(1);

                break;

            case this.opcodes['OUT@']:

                a = this.RAM.read(ALU.increment(this.PC));

                this.emit('OUT', this.RAM.read(a));

                this.jump(1);

                break;

            case this.opcodes['ADD%#']:

                a = this.RAM.read(ALU.increment(this.PC)),
                b = this.RAM.read(ALU.add(this.PC, [true, false]));

                this.setRegister(a, this.add(this.getRegister(a), b));

                this.jump(1);

                break;

            case this.opcodes['ADD%%']:

                a = this.RAM.read(ALU.increment(this.PC)),
                b = this.RAM.read(ALU.add(this.PC, [true, false]));

                this.setRegister(a, this.add(this.getRegister(a), this.getRegister(b)));

                this.jump(1);

                break;
                
            case this.opcodes['ADD%@']:

                a = this.RAM.read(ALU.increment(this.PC)),
                b = this.RAM.read(ALU.add(this.PC, [true, false]));

                this.setRegister(a, this.add(this.getRegister(a), this.RAM.read(b)));

                this.jump(1);

                break;

            case this.opcodes['SUB%#']:

                a = this.RAM.read(ALU.increment(this.PC)),
                b = this.RAM.read(ALU.add(this.PC, [true, false]));

                this.setRegister(a, this.sub(this.getRegister(a), b));

                this.jump(1);

                break;

             case this.opcodes['SUB%%']:

                a = this.RAM.read(ALU.increment(this.PC)),
                b = this.RAM.read(ALU.add(this.PC, [true, false]));

                this.setRegister(a, this.sub(this.getRegister(a), this.getRegister(b)));

                this.jump(1);

                break;
                
            case this.opcodes['SUB%@']:

                a = this.RAM.read(ALU.increment(this.PC)),
                b = this.RAM.read(ALU.add(this.PC, [true, false]));

                this.setRegister(a, this.sub(this.getRegister(a), this.RAM.read(b)));

                this.jump(1);

                break; 

            case this.opcodes['MUL%%']:
                a = this.RAM.read(ALU.increment(this.PC)),
                b = this.RAM.read(ALU.add(this.PC, [true, false]));

                this.setRegister(a, this.mult(this.getRegister(a), this.getRegister(b)));

                this.jump(1);

                break;

            case this.opcodes['MUL%#']:

                a = this.RAM.read(ALU.increment(this.PC)),
                b = this.RAM.read(ALU.add(this.PC, [true, false]));

                this.setRegister(a, this.mult(this.getRegister(a), b));

                this.jump(1);

                break;

            case this.opcodes['MUL%@']:

                a = this.RAM.read(ALU.increment(this.PC)),
                b = this.RAM.read(ALU.add(this.PC, [true, false]));

                this.setRegister(a, this.mult(this.getRegister(a), this.RAM.read(b)));

                this.jump(1);

                break;

            case this.opcodes['INC%']:

                a = this.RAM.read(ALU.increment(this.PC));

                this.setRegister(a, this.add(this.getRegister(a), [true]));

                this.jump(1);

                break;

            case this.opcodes['DEC%']:

                a = this.RAM.read(ALU.increment(this.PC));

                this.setRegister(a, this.sub(this.getRegister(a), [true]));

                this.jump(1);

                break;

            case this.opcodes['CMP%%']:

                a = this.RAM.read(ALU.increment(this.PC)),
                b = this.RAM.read(ALU.add(this.PC, [true, false]));

                this.sub(this.getRegister(a), this.getRegister(b));

                this.jump(1);

                break;

            case this.opcodes['CMP%@']:

                a = this.RAM.read(ALU.increment(this.PC)),
                b = this.RAM.read(ALU.add(this.PC, [true, false]));

                this.sub(this.getRegister(a), this.RAM.read(b));

                this.jump(1);

                break;

            case this.opcodes['CMP%#']:

                a = this.RAM.read(ALU.increment(this.PC)),
                b = this.RAM.read(ALU.add(this.PC, [true, false]));

                this.sub(this.getRegister(a), b);

                this.jump(1);

                break;

            case this.opcodes['JMP%']:

                a = this.RAM.read(ALU.increment(this.PC));

                this.PC = a;

                break;

            case this.opcodes['JMP!']:

                a = this.RAM.read(ALU.increment(this.PC));

                this.jump(a);

                break;

            case this.opcodes['JC%']:

                a = this.RAM.read(ALU.increment(this.PC));

                if (this.status_reg.CARRY) this.PC = a;
                else this.jump(1);

                break;

            case this.opcodes['JC!']:

                a = this.RAM.read(ALU.increment(this.PC));

                if (this.status_reg.CARRY) this.jump(a);
                else this.jump(1);

                break;

            case this.opcodes['JNC%']:

                a = this.RAM.read(ALU.increment(this.PC));

                if (!this.status_reg.CARRY) this.PC = a;
                else this.jump(1);

                break;

            case this.opcodes['JNC!']:

                a = this.RAM.read(ALU.increment(this.PC));

                if (!this.status_reg.CARRY) this.jump(a);
                else this.jump(1);

                break;

            case this.opcodes['JEQ%']:

                a = this.RAM.read(ALU.increment(this.PC));

                if (this.status_reg.ZERO) this.PC = a;
                else this.jump(1);

                break;

            case this.opcodes['JEQ!']:

                a = this.RAM.read(ALU.increment(this.PC));

                if (this.status_reg.ZERO) this.jump(a);
                else this.jump(1);

                break;

            case this.opcodes['JNE%']:

                a = this.RAM.read(ALU.increment(this.PC));

                if (!this.status_reg.ZERO) this.PC = a;
                else this.jump(1);

                break;

            case this.opcodes['JNE!']:

                a = this.RAM.read(ALU.increment(this.PC));

                if (!this.status_reg.ZERO) this.jump(a);
                else this.jump(1);

                break;

            case this.opcodes['JGTR%']:

                a = this.RAM.read(ALU.increment(this.PC));

                if (!this.status_reg.SIGN) this.PC = a;
                else this.jump(1);

                break;

            case this.opcodes['JGTR!']:

                a = this.RAM.read(ALU.increment(this.PC));

                if (!this.status_reg.SIGN) this.jump(a);
                else this.jump(1);

                break;

            case this.opcodes['JLSS%']:

                a = this.RAM.read(ALU.increment(this.PC));

                if (this.status_reg.SIGN) this.PC = a;
                else this.jump(1);

                break;

            case this.opcodes['JLSS!']:

                a = this.RAM.read(ALU.increment(this.PC));

                if (this.status_reg.SIGN) this.jump(a);
                else this.jump(1);

                break;
        }

        
        this.emit('step', this.PC);
    }

    private jump(relative: byte | number) { //mult by 3, because each instruction is stored in 3 consecutive bytes
        if (relative instanceof Array) 
            this.PC = this.add(this.PC, this.mult(relative, [true, true]), false);
        else this.PC = this.add(this.PC, Utils.num2byte(relative * 3, this.arch.bits), false);
    }

    run(addr: number, clean: boolean = true): void { //runs instructions until HLT

        this.PC = Utils.num2byte(addr, this.arch.bits);

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

    getRegister(addr: byte): bits {

        return this.registers.read(addr);
    }

    setRegister(addr: byte, value: bits): void {

        this.registers.write(addr, value);
    }

    reset(clearRAM: boolean = true): void {

        this.registers.clear();
        if (clearRAM) this.RAM.clear();

        this.status_reg = { CARRY: false, ZERO: false, SIGN: false };
        this.PC = [];
        this.IR = [];
        this.running = false;

        this.emit('reset');
    }

    halt(msg: string = '') {
        console.warn('Computer halted: ' + msg);
        this.running = false;

        this.emit('error', msg);
    }

    private add(a: byte, b: byte, flags = true) : byte {

        let sum = ALU.add(a, b);

        
        if (sum.length > this.arch.bits)
            sum = sum.slice(1, this.arch.bits + 1);

        if (flags) {

            //CARRY FLAG
            this.status_reg.CARRY = sum.length > this.arch.bits;

            //ZERO FLAG
            let EQU_ZERO = true;

            for (let bit of sum) {
                if (bit) {
                    EQU_ZERO = false;
                    break;
                }
            }
            
            this.status_reg.ZERO = EQU_ZERO;


            //SIGN FLAG

            this.status_reg.SIGN = sum[0];

        }

        return this.toByte(sum);

    }

    private sub(a: byte, b: byte) : byte {
        let res = this.add(this.toByte(a), ALU.negate(b, this.arch.bits));

        return res;
    }

    private mult(a: byte, b: byte) {

        a = this.toByte(a);
        b = this.toByte(b);

        let neg = a[0] !== b[0];

        if (neg) {
            if (a[0]) a = ALU.negate(a, this.arch.bits);
            else b = ALU.negate(b, this.arch.bits);
        }

        let mul = ALU.mult(a, b);

        if (neg) mul = ALU.negate(mul, this.arch.bits);

        this.status_reg.ZERO = ALU.equ(a, [false]) || ALU.equ(b, [false]);

        this.status_reg.CARRY = mul.length > this.arch.bits;

        return mul.splice(mul.length - this.arch.bits, this.arch.bits);
    }


}