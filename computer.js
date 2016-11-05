let Utils = {
    bits2num: (register) => {
        let b = '';
        for (let bit of register)
            b += bit ? '1' : '0';
        return parseInt(b, 2);
    },
    num2bits: (register) => {
        let b = [];
        for (let bit of register.toString(2))
            b.push(bit === '1');
        return b;
    },
    fillZeros: (num, count, backwards = false) => {
        let b = [];
        if (typeof (num) === 'number')
            b = Utils.num2bits(num);
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
    str2bits: (data) => {
        let b = [];
        for (let bit of data)
            b.push(bit === '1');
        return b;
    },
    negativeBinary: (bin) => {
        for (let i = 0; i < bin.length; i++)
            bin[i] = !bin[i];
        return Utils.num2bits(Utils.bits2num(bin) + 1);
    },
    xor: (a, b) => {
        return (a || b) && !(a && b);
    },
    bitAdder(a, b, carry) {
        let a_xor_b = Utils.xor(a, b);
        return {
            sum: Utils.xor(a_xor_b, carry),
            carry: (a_xor_b && carry) || (a && b)
        };
    },
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
        this.memory = [];
        for (let i = 0; i < nb_bytes; i++)
            this.memory[i] = [];
    }
    read(addr) {
        if (addr >= this.capacity)
            this.emit('error', `Incorrect RAM address: ${addr}`);
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
}
class Computer extends EventEmitter {
    constructor(arch) {
        super();
        this.STEP_LIMIT = 10000;
        this.running = false;
        this.instNames = [
            'AEQ',
            'LDA',
            'STA',
            'JMP',
            'ADD',
            'JC',
            'OUT',
            'SUB',
            'INC',
            'CMP',
            'JNEQ',
            'HLT' //HLT : Stop execution
        ];
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
    compile(prog) {
        let binary = [];
        let bitsPerInst = Math.ceil((this.instCodeBitCount + 2 + this.arch.bits) / this.arch.bits) * this.arch.bits;
        for (let inst of prog.split('\n')) {
            //Translate the instruction into binary
            //Find current instruction's code
            inst = inst.trim();
            let instBinary = [];
            if (inst === '')
                continue;
            let l = inst.split(' ');
            let n = this.instNames.indexOf(l[0]);
            if (n === -1)
                this.emit('error', 'Unknown instruction: ' + l[0]);
            instBinary.push(...Utils.fillZeros(n, this.instCodeBitCount)); //Add instruction code
            //Handle the argument
            if (l[1] === undefined)
                l[1] = '';
            let arg = 0;
            instBinary.push(l[1][0] === '#'); //numerical value or RAM addr ?
            instBinary.push(l[1][0] === '%'); //register addr
            l[1] = l[1].replace('#', '').replace('%', '');
            if (l[1].substr(0, 1) === '$') {
                arg = parseInt(l[1].replace('$', ''), 16);
            }
            else
                arg = parseInt(l[1]);
            instBinary.push(...Utils.fillZeros(arg, bitsPerInst - instBinary.length));
            //binary.push(...Utils.fillZeros(instBinary, bitsPerInst, true));
            binary.push(...instBinary);
        }
        return binary;
    }
    loadProgram(prog) {
        if (!(prog instanceof String)) {
            this.instructions = [];
            this.PC = 0;
            let instLen = Math.ceil((this.instCodeBitCount + 2 + this.arch.bits) / this.arch.bits) * this.arch.bits;
            for (let i = 0; i < prog.length; i += instLen)
                this.instructions.push(prog.slice(i, i + instLen));
        }
        else
            this.loadProgram(Utils.str2bits(prog));
    }
    step() {
        if (this.PC >= this.instructions.length) {
            this.emit('error', 'No instruction at addr: ' + this.PC.toString(16));
        }
        let inst = this.instructions[this.PC];
        let icode = Utils.bits2num(inst.slice(0, this.instCodeBitCount));
        let argBin = inst.slice(this.instCodeBitCount + 2, inst.length);
        let arg = Utils.bits2num(argBin);
        if (!inst[this.instCodeBitCount]) {
            argBin = this.RAM.read(arg);
            arg = Utils.bits2num(argBin);
        }
        else if (inst[this.instCodeBitCount + 1]) {
            argBin = this.getRegister(arg);
            arg = Utils.bits2num(argBin);
        }
        switch (icode) {
            case 0:
                this.setRegister(0, argBin);
                this.PC++;
                break;
            case 1:
                this.setRegister(0, argBin);
                this.PC++;
                break;
            case 2:
                this.setRegister(arg, this.getRegister(0));
                this.PC++;
                break;
            case 3:
                this.PC = arg;
                break;
            case 4:
                this.setRegister(0, this.ALU(this.getRegister(0), argBin));
                this.PC++;
                break;
            case 5:
                if (this.status_reg[0])
                    this.PC = arg;
                else
                    this.PC++;
                break;
            case 6:
                this.emit('OUT', `${Utils.bits2str(this.getRegister(0))} - ${Utils.bits2num(this.getRegister(0))}`);
                this.PC++;
                break;
            case 7:
                //TODO
                break;
            case 8:
                this.registers[arg] = this.ALU(this.registers[arg], [true]);
                this.PC++;
                break;
            case 9:
                this.status_reg[1] = Utils.bits2num(this.getRegister(0)) === arg;
                this.PC++;
                break;
            case 10:
                if (!this.status_reg[1]) {
                    this.PC = arg;
                }
                else
                    this.PC++;
                break;
            case 11:
                this.running = false;
                break;
        }
        this.emit('step', this.PC);
    }
    run(clean = true) {
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
    reset(cleanInstructions = true) {
        for (let i = 0; i < this.arch.registerCount; i++)
            this.registers[i] = [];
        if (cleanInstructions)
            this.instructions = [];
        this.status_reg = [false, false];
        this.PC = 0;
        this.running = false;
        this.emit('reset');
    }
    halt(msg = '') {
        console.warn('Computer halted: ' + msg);
        this.running = false;
        this.emit('halt', msg);
    }
    ALU(a, b, sub = false) {
        let sum = [], carry = false;
        let m = Math.max(a.length, b.length);
        if (a.length !== m) {
            a = Utils.fillZeros(a, m);
        }
        else
            b = Utils.fillZeros(b, m);
        for (let i = m - 1; i >= 0; i--) {
            let s = Utils.bitAdder(a[i], b[i], carry);
            sum.unshift(s.sum);
            carry = s.carry;
        }
        if (carry) {
            if (sum.length < this.arch.bits) {
                sum.push(true);
            }
            else
                this.status_reg[0] = true;
        }
        return sum;
    }
}
