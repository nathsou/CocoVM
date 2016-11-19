let Utils = {
    byte2num: (a, byteLength) => {
        let b = '';
        for (let i = 1; i < a.length; i++)
            b += a[i] ? '1' : '0';
        let val = parseInt(b, 2);
        if (!a[0])
            return val; //it's positive
        //it's negative
        return val - Math.abs((1 << (byteLength - 1)));
    },
    num2byte: (a, byteLength) => {
        let b = [];
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
    fillZeros: (num, count, backwards = false) => {
        let b = [];
        if (typeof (num) === 'number')
            b = Utils.num2byte(num, count);
        else
            b = num;
        for (let i = b.length; i < count; i++) {
            if (!backwards)
                b.unshift(false);
            else
                b.push(false);
        }
        return b;
    },
    bits2str: (data) => {
        let str = '';
        for (let bit of data)
            str += bit ? '1' : '0';
        return str;
    },
    bits2hexstr: (data) => {
        let bin = Utils.bits2str(data);
        let hex = '';
        let fillHex = (hex) => {
            for (let i = 0; i < 4 - hex.length; i++)
                hex = '0' + hex;
            return hex;
        };
        for (let i = 0; i < bin.length; i += 16)
            hex += fillHex(parseInt(bin.substr(i, 16), 2).toString(16)) + ' ';
        return hex;
    },
    bytesEQU: (a, b) => {
        if (a.length !== b.length)
            return false;
        for (let i = 0; i < a.length; i++)
            if (a[i] !== b[i])
                return false;
        return true;
    },
    str2bits: (data) => {
        let b = [];
        for (let bit of data)
            b.push(bit === '1');
        return b;
    },
    xor: (a, b) => {
        return (a || b) && !(a && b);
    },
    necessaryBitCount: (n) => {
        if (n === 0)
            return 1;
        return Math.floor(Math.log2(n)) + 1;
    }
};
/// <reference path="Utils.ts" />
class ALU {
    //Arithmetic
    //1 bit full adder
    static bitAdder(a, b, carry) {
        let a_xor_b = this.xor(a, b);
        return {
            sum: this.xor(a_xor_b, carry),
            carry: (a_xor_b && carry) || (a && b)
        };
    }
    static add(a, b) {
        let sum = [], carry = false;
        let m = Math.max(a.length, b.length);
        if (a.length !== m) {
            a = Utils.fillZeros(a, m);
        }
        else
            b = Utils.fillZeros(b, m);
        for (let i = m - 1; i >= 0; i--) {
            let s = this.bitAdder(a[i], b[i], carry);
            sum.unshift(s.sum);
            carry = s.carry;
        }
        if (carry)
            sum.unshift(true);
        return sum;
    }
    static mult(a, b) {
        let m = Math.max(a.length, b.length);
        let a_ = Utils.fillZeros(a.slice(), m);
        let sum = [false]; //0
        for (let i = m - 1; i >= 0; i--) {
            if (b[i])
                sum = ALU.add(sum, a_);
            a_ = ALU.shiftLeft(a_);
        }
        return sum;
    }
    static lss(a, b) {
        if (a.length >= b.length)
            Utils.fillZeros(b, a.length);
        else
            Utils.fillZeros(a, b.length);
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) {
                if (a[i])
                    return false;
                else
                    return true;
            }
        }
        return false;
    }
    static leq(a, b) {
        if (a.length >= b.length)
            Utils.fillZeros(b, a.length);
        else
            Utils.fillZeros(a, b.length);
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) {
                if (a[i])
                    return false;
                else
                    return true;
            }
        }
        return true;
    }
    static geq(a, b) {
        return !this.lss(a, b);
    }
    static gtr(a, b) {
        return !this.leq(a, b);
    }
    static equ(a, b) {
        if (a.length >= b.length)
            Utils.fillZeros(b, a.length);
        else
            Utils.fillZeros(a, b.length);
        for (let i = 0; i < a.length; i++)
            if (a[i] !== b[i])
                return false;
        return true;
    }
    static increment(a) {
        return this.add(a, [true]);
    }
    static complement(a, byteLength) {
        let copy = a.slice();
        for (let i = 0; i < a.length; i++)
            copy[i] = !copy[i];
        return Utils.fillZeros(copy, byteLength);
    }
    static negate(a, byteLength) {
        return this.add(this.complement(Utils.fillZeros(a, byteLength), byteLength), [true]); //complement and add 1
    }
    static sub(a, b, byteLength) {
        return this.add(a, this.negate(b, byteLength));
    }
    static shiftLeft(a) {
        let copy = a.slice();
        copy.push(false);
        return copy;
    }
    static shiftRight(a) {
        let copy = a.slice();
        copy.pop();
        copy.unshift(false);
        return copy;
    }
    //Logic
    static not(a) {
        return !a;
    }
    static andMask(a, mask) {
        let r = [];
        let m = Math.max(a.length, mask.length);
        let a_ = Utils.fillZeros(a, m);
        let mask_ = Utils.fillZeros(mask, m);
        for (let i = 0; i < m; i++)
            r.push(mask_[i] && a_[i]);
        return r;
    }
    static and(a, b) {
        return a && b;
    }
    static or(a, b) {
        return a || b;
    }
    static nand(a, b) {
        return !(a && b);
    }
    static nor(a, b) {
        return !(a || b);
    }
    static xor(a, b) {
        return (a || b) && !(a && b);
    }
}
class EventEmitter {
    constructor() {
        this.eventHandlers = new Map();
    }
    on(ev, handler) {
        this.eventHandlers.set(ev, handler);
    }
    emit(ev, value) {
        if (this.eventHandlers.has(ev))
            this.eventHandlers.get(ev).call(this, value);
    }
    bindEvent(em, ev) {
        em.on(ev, (value) => this.emit(ev, value));
    }
}
/// <reference path="EventEmitter.ts" />
/// <reference path="Utils.ts" />
class Memory extends EventEmitter {
    constructor(name = 'memory', byteLength, nb_bytes) {
        super();
        this.name = name;
        this.byteLength = byteLength;
        this.capacity = nb_bytes;
        this.zero = Utils.fillZeros(0, byteLength);
        this.memory = new Map();
        this.clear();
    }
    read(addr) {
        if (addr instanceof Array)
            addr = Utils.bits2str(addr);
        if (addr.length > this.byteLength)
            this.emit('error', `Incorrect ${this.name} address: ${addr}`);
        if (this.memory.get(addr) === undefined)
            return this.zero.slice();
        return this.memory.get(addr);
    }
    write(addr, value) {
        if (addr instanceof Array)
            addr = Utils.bits2str(addr);
        if (addr.length > this.byteLength)
            this.emit('error', `Incorrect ${this.name} address: ${addr}`);
        if (value.length > this.byteLength)
            this.emit('error', `Cannot store ${value.length} bits of data in ${this.name}, since 1 byte = ${this.byteLength}`);
        else
            this.memory.set(addr, Utils.fillZeros(value, this.byteLength));
    }
    clear() {
        this.memory.clear();
    }
}
/// <reference path="Utils.ts" />
/// <reference path="Memory.ts" />
/// <reference path="ALU.ts" />
/// <reference path="Architecture.ts" />
/// <reference path="EventEmitter.ts" />
class Cpu extends EventEmitter {
    constructor(arch) {
        super();
        this.STEP_LIMIT = 100000;
        this.running = false;
        this.opcodes = {
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
            'JMP%': 18,
            'JMP!': 19,
            'JC%': 20,
            'JC!': 21,
            'JNC%': 22,
            'JNC!': 23,
            'JZ%': 24,
            'JZ!': 25,
            'JEQ%': 20,
            'JEQ!': 21,
            'JNZ%': 26,
            'JNZ!': 27,
            'JNE%': 22,
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
        this.status_reg = {
            'ZERO': false,
            'CARRY': false,
            'SIGN': false
        };
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
    toByte(n) {
        if (n instanceof Array)
            return Utils.fillZeros(n, this.arch.bits);
        return Utils.fillZeros(Utils.num2byte(n, this.arch.bits), this.arch.bits);
    }
    compile(prog) {
        let binary = [];
        let instructions = [];
        let labels = new Map();
        //Remove comments and blank lines & identify labels
        for (let inst of prog.split('\n')) {
            inst = inst.trim();
            if (inst === '' || inst[0] === ';')
                continue;
            let label;
            if ((label = /^[.A-Za-z]\w*:$/.exec(inst)) !== null) {
                labels.set(label[0].replace(':', ''), instructions.length);
            }
            else
                instructions.push(inst);
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
            if (l[0] === '') {
                l[0] = l[1];
                l[1] = '';
            }
            //Handle the operand(s);
            let inst_name = l[0];
            let operands = [];
            for (let arg of l[1].split(',')) {
                arg = arg.trim();
                if (arg === '')
                    continue;
                //replace labels with relative address
                let label;
                if ((label = /^[.A-Za-z]\w*$/.exec(arg)) !== null) {
                    label = label[0];
                    if (labels.has(label)) {
                        let relative = labels.get(label) - i;
                        arg = `!${relative}`;
                    }
                    else
                        this.emit('error', `Label not foud: ${label}`);
                }
                inst_name += arg[0];
                if (['%', '@', '#', '!'].indexOf(arg[0]) === -1) {
                    this.emit('error', 'Invalid addressing mode identifier: ' + arg[0]);
                    break;
                }
                let val = 0;
                arg = arg.replace(arg[0], '');
                switch (arg[0]) {
                    case '$':
                        operands.push(parseInt(arg, 16));
                        break;
                    case 'b':
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
                    else
                        binary.push(...this.toByte(0));
                }
            }
            else
                this.emit('error', 'Unknown instruction: ' + inst_name);
        }
        return binary;
    }
    loadProgram(prog, addr) {
        if (!(prog instanceof String)) {
            let c = Utils.num2byte(addr, this.arch.bits);
            for (let i = 0; i < prog.length; i += this.arch.bits) {
                this.RAM.write(c, prog.slice(i, i + this.arch.bits));
                c = ALU.increment(c);
            }
        }
        else
            this.loadProgram(Utils.str2bits(prog), addr);
    }
    byte2num(a) {
        return Utils.byte2num(a, this.arch.bits);
    }
    step() {
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
                if (this.status_reg.CARRY)
                    this.PC = a;
                else
                    this.jump(1);
                break;
            case this.opcodes['JC!']:
                a = this.RAM.read(ALU.increment(this.PC));
                if (this.status_reg.CARRY)
                    this.jump(a);
                else
                    this.jump(1);
                break;
            case this.opcodes['JNC%']:
                a = this.RAM.read(ALU.increment(this.PC));
                if (!this.status_reg.CARRY)
                    this.PC = a;
                else
                    this.jump(1);
                break;
            case this.opcodes['JNC!']:
                a = this.RAM.read(ALU.increment(this.PC));
                if (!this.status_reg.CARRY)
                    this.jump(a);
                else
                    this.jump(1);
                break;
            case this.opcodes['JEQ%']:
                a = this.RAM.read(ALU.increment(this.PC));
                if (this.status_reg.ZERO)
                    this.PC = a;
                else
                    this.jump(1);
                break;
            case this.opcodes['JEQ!']:
                a = this.RAM.read(ALU.increment(this.PC));
                if (this.status_reg.ZERO)
                    this.jump(a);
                else
                    this.jump(1);
                break;
            case this.opcodes['JNE%']:
                a = this.RAM.read(ALU.increment(this.PC));
                if (!this.status_reg.ZERO)
                    this.PC = a;
                else
                    this.jump(1);
                break;
            case this.opcodes['JNE!']:
                a = this.RAM.read(ALU.increment(this.PC));
                if (!this.status_reg.ZERO)
                    this.jump(a);
                else
                    this.jump(1);
                break;
            case this.opcodes['JGTR%']:
                a = this.RAM.read(ALU.increment(this.PC));
                if (!this.status_reg.SIGN)
                    this.PC = a;
                else
                    this.jump(1);
                break;
            case this.opcodes['JGTR!']:
                a = this.RAM.read(ALU.increment(this.PC));
                if (!this.status_reg.SIGN)
                    this.jump(a);
                else
                    this.jump(1);
                break;
            case this.opcodes['JLSS%']:
                a = this.RAM.read(ALU.increment(this.PC));
                if (this.status_reg.SIGN)
                    this.PC = a;
                else
                    this.jump(1);
                break;
            case this.opcodes['JLSS!']:
                a = this.RAM.read(ALU.increment(this.PC));
                if (this.status_reg.SIGN)
                    this.jump(a);
                else
                    this.jump(1);
                break;
        }
        this.emit('step', this.PC);
    }
    jump(relative) {
        if (relative instanceof Array)
            this.PC = this.add(this.PC, this.mult(relative, [true, true]), false);
        else
            this.PC = this.add(this.PC, Utils.num2byte(relative * 3, this.arch.bits), false);
    }
    run(addr, clean = true) {
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
        if (clean)
            this.reset(false);
    }
    getRegister(addr) {
        return this.registers.read(addr);
    }
    setRegister(addr, value) {
        this.registers.write(addr, value);
    }
    reset(clearRAM = true) {
        this.registers.clear();
        if (clearRAM)
            this.RAM.clear();
        this.status_reg = { CARRY: false, ZERO: false, SIGN: false };
        this.PC = [];
        this.IR = [];
        this.running = false;
        this.emit('reset');
    }
    halt(msg = '') {
        console.warn('Computer halted: ' + msg);
        this.running = false;
        this.emit('error', msg);
    }
    add(a, b, flags = true) {
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
    sub(a, b) {
        let res = this.add(this.toByte(a), ALU.negate(b, this.arch.bits));
        return res;
    }
    mult(a, b) {
        a = this.toByte(a);
        b = this.toByte(b);
        let neg = a[0] !== b[0];
        if (neg) {
            if (a[0])
                a = ALU.negate(a, this.arch.bits);
            else
                b = ALU.negate(b, this.arch.bits);
        }
        let mul = ALU.mult(a, b);
        if (neg)
            mul = ALU.negate(mul, this.arch.bits);
        this.status_reg.ZERO = ALU.equ(a, [false]) || ALU.equ(b, [false]);
        this.status_reg.CARRY = mul.length > this.arch.bits;
        return mul.splice(mul.length - this.arch.bits, this.arch.bits);
    }
}
