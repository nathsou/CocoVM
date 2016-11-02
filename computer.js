var Utils = {
    bool2num: function (register) {
        var b = '';
        for (var _i = 0, register_1 = register; _i < register_1.length; _i++) {
            var bit = register_1[_i];
            b += bit ? '1' : '0';
        }
        return parseInt(b, 2);
    },
    num2bool: function (register) {
        var b = [];
        for (var _i = 0, _a = register.toString(2); _i < _a.length; _i++) {
            var bit = _a[_i];
            b.push(bit === '1');
        }
        return b;
    },
    fillZeros: function (num, count) {
        var b = [];
        if (typeof (num) === 'number')
            b = Utils.num2bool(num);
        else
            b = num;
        for (var i = b.length; i < count; i++)
            b.unshift(false);
        return b;
    },
    bits2str: function (data) {
        var str = '';
        for (var _i = 0, data_1 = data; _i < data_1.length; _i++) {
            var bit = data_1[_i];
            str += bit ? '1' : '0';
        }
        return str;
    },
    str2bits: function (data) {
        var b = [];
        for (var _i = 0, data_2 = data; _i < data_2.length; _i++) {
            var bit = data_2[_i];
            b.push(bit === '1');
        }
        return b;
    },
    negativeBinary: function (bin) {
        for (var i = 0; i < bin.length; i++)
            bin[i] = !bin[i];
        return Utils.num2bool(Utils.bool2num(bin) + 1);
    },
    xor: function (a, b) {
        return (a || b) && !(a && b);
    },
    bitAdder: function (a, b, carry) {
        var a_xor_b = Utils.xor(a, b);
        return {
            sum: Utils.xor(a_xor_b, carry),
            carry: (a_xor_b && carry) || (a && b)
        };
    },
};
var Computer = (function () {
    function Computer(arch) {
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
        this.registers = [];
        for (var i = 0; i < arch.registerCount; i++) {
            this.registers[i] = [];
        }
        this.instructions = [];
        this.accumulator = [];
        this.status_reg = [false, false]; //overflow, zero
        this.instAddr = 0;
        this.instCodeBitCount = Math.floor(Math.log(this.instNames.length) / Math.LN2) + 1;
    }
    Computer.prototype.compile = function (prog) {
        var binary = [];
        for (var _i = 0, _a = prog.split('\n'); _i < _a.length; _i++) {
            var inst = _a[_i];
            if (inst.trim() === '')
                continue;
            var l = inst.trim().split(' ');
            var n = null;
            for (var i = 0; i < this.instNames.length; i++) {
                if (this.instNames[i] === l[0])
                    n = i;
            }
            if (n === null) {
                alert('Unknown instruction: ' + l[0]);
            }
            for (var _b = 0, _c = Utils.fillZeros(n, this.instCodeBitCount); _b < _c.length; _b++) {
                var bit = _c[_b];
                binary.push(bit);
            }
            if (l[1] === undefined) {
                for (var i = 0; i < this.arch.bits; i++)
                    binary.push(false);
                continue;
            }
            //convert the argument to hex
            var arg = 0;
            if (l[1].substr(0, 2) === '0x') {
                arg = parseInt(l[1]);
            }
            else if (l[1][l[1].length - 1] === 'd') {
                arg = parseInt(l[1].replace('d', ''));
            }
            else {
                arg = parseInt(l[1], 2);
            }
            for (var _d = 0, _e = Utils.fillZeros(arg, this.arch.bits); _d < _e.length; _d++) {
                var bit = _e[_d];
                binary.push(bit);
            }
        }
        return binary;
    };
    Computer.prototype.loadProgram = function (prog) {
        if (!(prog instanceof String)) {
            this.instructions = [];
            this.instAddr = 0;
            var instLen = this.instCodeBitCount + this.arch.bits;
            for (var i = 0; i < prog.length; i += instLen)
                this.instructions.push(prog.slice(i, i + instLen));
        }
        else
            this.loadProgram(Utils.str2bits(prog));
    };
    Computer.prototype.step = function () {
        if (this.instAddr > this.instructions.length) {
            alert('No instruction at addr: ' + this.instAddr.toString(16));
        }
        var inst = this.instructions[this.instAddr];
        var icode = Utils.bool2num(inst.slice(0, this.instCodeBitCount));
        var argBin = inst.slice(this.instCodeBitCount, inst.length);
        var arg = Utils.bool2num(argBin);
        switch (icode) {
            case 0:
                this.accumulator = argBin;
                this.instAddr++;
                break;
            case 1:
                this.accumulator = this.registers[arg];
                this.instAddr++;
                break;
            case 2:
                this.registers[arg] = this.accumulator;
                this.instAddr++;
                break;
            case 3:
                this.instAddr = arg;
                break;
            case 4:
                this.accumulator = this.ALU(this.accumulator, this.registers[arg]);
                this.instAddr++;
                break;
            case 5:
                if (this.status_reg[0])
                    this.instAddr = arg;
                else
                    this.instAddr++;
                break;
            case 6:
                console.info(Utils.bits2str(this.accumulator) + ' - ' + Utils.bool2num(this.accumulator));
                this.instAddr++;
                break;
            case 7:
                //TODO
                break;
            case 8:
                this.registers[arg] = this.ALU(this.registers[arg], [true]);
                this.instAddr++;
                break;
            case 9:
                this.status_reg[1] = Utils.bool2num(this.accumulator) === arg;
                this.instAddr++;
                break;
            case 10:
                if (!this.status_reg[1]) {
                    this.instAddr = arg;
                }
                else
                    this.instAddr++;
                break;
            case 11:
                this.running = false;
                break;
        }
    };
    Computer.prototype.run = function (clean) {
        if (clean === void 0) { clean = true; }
        this.running = true;
        var steps = 0;
        while (this.running) {
            this.step();
            if (++steps > this.STEP_LIMIT) {
                alert('Infinite loop detected');
                break;
            }
        }
        if (clean)
            this.reset(false);
    };
    Computer.prototype.setRegister = function (n, value) {
        this.registers[n] = value;
    };
    Computer.prototype.reset = function (cleanInstructions) {
        if (cleanInstructions === void 0) { cleanInstructions = true; }
        for (var i = 0; i < this.arch.registerCount; i++) {
            this.registers[i] = [];
        }
        this.accumulator = [];
        if (cleanInstructions)
            this.instructions = [];
        this.status_reg = [false, false];
        this.instAddr = 0;
        this.running = false;
    };
    Computer.prototype.halt = function (msg) {
        if (msg === void 0) { msg = ''; }
        console.warn('Computer halted: ' + msg);
        this.running = false;
    };
    Computer.prototype.ALU = function (a, b, sub) {
        if (sub === void 0) { sub = false; }
        var sum = [], carry = false;
        var m = Math.max(a.length, b.length);
        if (a.length !== m) {
            a = Utils.fillZeros(a, m);
        }
        else
            b = Utils.fillZeros(b, m);
        for (var i = m - 1; i >= 0; i--) {
            var s = Utils.bitAdder(a[i], b[i], carry);
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
    };
    return Computer;
}());
