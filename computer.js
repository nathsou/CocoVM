let Utils = {
    byte2num: (a, byteLength) => {
        let b = '';
        for (let i = 1; i < a.length; i++)
            b += a[i] ? '1' : '0';
        let val = parseInt(b, 2);
        if (!a[0])
            return val; //it's positive
        //it's negative
        return val - (1 << (byteLength - 1));
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
    }
};
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
class RAM extends EventEmitter {
    constructor(byteLength, nb_bytes) {
        super();
        this.byteLength = byteLength;
        this.capacity = nb_bytes;
        this.clear();
    }
    read(addr) {
        if (addr >= this.capacity)
            this.emit('error', `Incorrect RAM address: ${addr}`);
        if (this.memory[addr].length === 0)
            return Utils.fillZeros(0, this.byteLength);
        return this.memory[addr];
    }
    write(addr, value) {
        if (addr >= this.capacity)
            this.emit('error', `Incorrect RAM address: ${addr}`);
        if (value.length > this.byteLength)
            this.emit('error', `Cannot store ${value.length} bits of data in RAM, since 1 byte = ${this.byteLength}`);
        else if (value.length < this.byteLength)
            value = Utils.fillZeros(value, this.byteLength);
        this.memory[addr] = value;
    }
    clear() {
        this.memory = [];
        for (let i = 0; i < this.capacity; i++)
            this.memory[i] = [];
    }
}
class Computer extends EventEmitter {
    constructor(arch) {
        super();
        this.STEP_LIMIT = 10000;
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
            'JNEQ%': 22,
            'JNEQ!': 28
        };
        this.status_reg = {
            'ZERO': false,
            'CARRY': false
        };
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
    toByte(n) {
        return Utils.fillZeros(Utils.num2byte(n, this.arch.bits), this.arch.bits);
    }
    compile(prog) {
        let binary = [];
        let instructions = [];
        let labels = new Map();
        //Remove comments and blank lines & identify labels
        let addr = 0;
        for (let inst of prog.split('\n')) {
            inst = inst.trim();
            if (inst === '' || inst[0] === ';')
                continue;
            let label;
            if ((label = /^[.A-Za-z]\w*:$/.exec(inst)) !== null) {
                labels.set(label[0].replace(':', ''), addr);
            }
            else
                instructions.push(inst);
            //count bytes
            if (inst.indexOf(' ') !== -1) {
                if (inst.indexOf(',') !== -1) {
                    addr += 3;
                }
                else {
                    addr += 2;
                }
            }
            else
                addr++;
        }
        //assemble instructions
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
            addr = 0;
            for (let arg of l[1].split(',')) {
                arg = arg.trim();
                addr++;
                if (arg === '')
                    continue;
                //replace labels with relative address
                let label;
                if ((label = /^[.A-Za-z]\w*$/.exec(arg)) !== null) {
                    label = label[0];
                    if (labels.has(label)) {
                        let relative = labels.get(label) - addr;
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
            addr += operands.length;
            if (opcode !== undefined) {
                binary.push(...this.toByte(opcode));
                for (let op of operands)
                    binary.push(...this.toByte(op));
            }
            else
                this.emit('error', 'Unknown instruction: ' + inst_name);
        }
        return binary;
    }
    loadProgram(prog, addr) {
        if (!(prog instanceof String)) {
            for (let i = 0; i < prog.length; i += this.arch.bits)
                this.RAM.write(addr + i / this.arch.bits, prog.slice(i, i + this.arch.bits));
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
                this.PC += 2;
                break;
            case this.opcodes['OUT@']:
                a = this.byte2num(this.RAM.read(this.PC + 1));
                this.emit('OUT', this.RAM.read(a));
                this.PC += 2;
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
                this.PC += 2;
                break;
            case this.opcodes['CMP%%']:
                a = this.byte2num(this.RAM.read(this.PC + 1)),
                    b = this.byte2num(this.RAM.read(this.PC + 2));
                this.status_reg.ZERO = Utils.bytesEQU(this.getRegister(a), this.getRegister(b));
                this.PC += 3;
                break;
            case this.opcodes['CMP%@']:
                a = this.byte2num(this.RAM.read(this.PC + 1)),
                    b = this.byte2num(this.RAM.read(this.PC + 2));
                this.status_reg.ZERO = Utils.bytesEQU(this.getRegister(a), this.RAM.read(b));
                this.PC += 3;
                break;
            case this.opcodes['CMP%#']:
                a = this.byte2num(this.RAM.read(this.PC + 1)),
                    b = this.byte2num(this.RAM.read(this.PC + 2));
                this.status_reg.ZERO = Utils.bytesEQU(this.getRegister(a), b);
                this.PC += 3;
                break;
            case this.opcodes['JMP%']:
                a = this.byte2num(this.RAM.read(this.PC + 1));
                this.PC = a;
                break;
            case this.opcodes['JMP!']:
                a = this.byte2num(this.RAM.read(this.PC + 1));
                this.PC += a;
                break;
            case this.opcodes['JC%']:
                a = this.byte2num(this.RAM.read(this.PC + 1));
                if (this.status_reg.CARRY)
                    this.PC = a;
                break;
            case this.opcodes['JC!']:
                a = this.byte2num(this.RAM.read(this.PC + 1));
                if (this.status_reg.CARRY)
                    this.PC += a;
                break;
            case this.opcodes['JNC%']:
                a = this.byte2num(this.RAM.read(this.PC + 1));
                if (!this.status_reg.CARRY)
                    this.PC = a;
                break;
            case this.opcodes['JNC!']:
                a = this.byte2num(this.RAM.read(this.PC + 1));
                if (!this.status_reg.CARRY)
                    this.PC += a;
                break;
            case this.opcodes['JEQ%']:
                a = this.byte2num(this.RAM.read(this.PC + 1));
                if (this.status_reg.ZERO)
                    this.PC = a;
                break;
            case this.opcodes['JEQ!']:
                a = this.byte2num(this.RAM.read(this.PC + 1));
                if (this.status_reg.ZERO)
                    this.PC += a;
                break;
            case this.opcodes['JNEQ%']:
                a = this.byte2num(this.RAM.read(this.PC + 1));
                if (!this.status_reg.ZERO)
                    this.PC = a;
                break;
            case this.opcodes['JNEQ!']:
                a = this.byte2num(this.RAM.read(this.PC + 1));
                if (!this.status_reg.ZERO)
                    this.PC += a;
                break;
        }
        this.emit('step', this.PC);
    }
    run(addr, clean = true) {
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
        if (clean)
            this.reset(false);
    }
    getRegister(n) {
        if (n >= this.arch.registerCount)
            this.emit('error', 'Invalid register address: ' + n);
        return this.registers[n];
    }
    setRegister(n, value) {
        if (n >= this.arch.registerCount)
            this.emit('error', 'Invalid register address: ' + n);
        this.registers[n] = value;
    }
    reset(clearRAM = true) {
        for (let i = 0; i < this.arch.registerCount; i++)
            this.registers[i] = [];
        if (clearRAM)
            this.RAM.clear();
        this.status_reg = { CARRY: false, ZERO: false };
        this.PC = 0;
        this.IR = [];
        this.running = false;
        this.emit('reset');
    }
    halt(msg = '') {
        console.warn('Computer halted: ' + msg);
        this.running = false;
        this.emit('error', msg);
    }
}
class ALU {
    constructor(computer) {
        this.computer = computer;
    }
    //Arithmetic
    //1 bit full adder
    bitAdder(a, b, carry) {
        let a_xor_b = this.xor(a, b);
        return {
            sum: this.xor(a_xor_b, carry),
            carry: (a_xor_b && carry) || (a && b)
        };
    }
    add(a, b) {
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
        //CARRY FLAG
        if (carry) {
            if (sum.length < this.computer.arch.bits) {
                sum.push(true);
            }
            else
                this.computer.status_reg.CARRY = true;
        }
        //ZERO FLAG
        let EQU_ZERO = true;
        for (let bit of sum) {
            if (bit)
                EQU_ZERO = false;
            break;
        }
        if (!this.computer.status_reg.CARRY && EQU_ZERO)
            this.computer.status_reg.ZERO = true;
        return sum;
    }
    complement(a) {
        for (let i = 0; i < a.length; i++)
            a[i] = !a[i];
        return a;
    }
    negate(a) {
        return this.add(this.complement(a), [true]); //complement and add 1
    }
    sub(a, b) {
        return this.add(a, this.negate(b));
    }
    //Logic
    not(a) {
        return !a;
    }
    and(a, b) {
        return a && b;
    }
    or(a, b) {
        return a || b;
    }
    nand(a, b) {
        return !(a && b);
    }
    nor(a, b) {
        return !(a || b);
    }
    xor(a, b) {
        return (a || b) && !(a && b);
    }
}
