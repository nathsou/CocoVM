/// <reference path="Utils.ts" />

abstract class ALU { //Arithmetic-logic unit

    //Arithmetic

    //1 bit full adder
    static bitAdder(a: bit, b: bit, carry: bit): { sum: bit, carry: bit } { 

        let a_xor_b = this.xor(a, b);

        return {
            sum: this.xor(a_xor_b, carry),
            carry: (a_xor_b && carry) || (a && b)
        };
    }

    static add(a: byte, b: byte) : byte { //binary adder

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
        
        if (carry) sum.unshift(true);

        return sum;
    }


    static mult(a: byte, b: byte) : byte { //binary multiplier

        let m = Math.max(a.length, b.length);

        let a_ = Utils.fillZeros(a.slice(), m);

        let sum = [false]; //0

        for (let i = m - 1; i >= 0; i--) {
            if (b[i]) sum = ALU.add(sum, a_); 
            a_ = ALU.shiftLeft(a_);
        }

        return sum;

    }

    static lss(a: bits, b: bits) : boolean { //test wether a < b

        if (a.length >= b.length)
            Utils.fillZeros(b, a.length);
        else Utils.fillZeros(a, b.length);

        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) {
                if (a[i]) return false;
                else return true;
            }
        }

        return false;

    }

    static leq(a: bits, b: bits) : boolean { //test wether a <= b
        if (a.length >= b.length)
            Utils.fillZeros(b, a.length);
        else Utils.fillZeros(a, b.length);

        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) {
                if (a[i]) return false;
                else return true;
            }
        }

        return true;
    }

    static geq(a: bits, b: bits) : boolean { //test wether a >= b
        return !this.lss(a, b);
    }

    static gtr(a: bits, b: bits) : boolean { //test wether a > b
        return !this.leq(a, b);
    }

    static equ(a: bits, b: bits) : boolean { //test wether a = b
        
        if (a.length >= b.length)
            Utils.fillZeros(b, a.length);
        else Utils.fillZeros(a, b.length);

        for (let i = 0; i < a.length; i++) 
            if (a[i] !== b[i]) return false;

        return true;

    }

    static increment(a: byte) : byte {

        return this.add(a, [true]);
    }

    static complement(a: byte, byteLength: number) : byte {

        let copy = a.slice();

        for (let i = 0; i < a.length; i++)
            copy[i] = !copy[i];

        return Utils.fillZeros(copy, byteLength);
    }

    static negate(a: byte, byteLength: number) : byte { //negate (two's complement)

        return this.add(this.complement(Utils.fillZeros(a, byteLength), byteLength), [true]); //complement and add 1
    }

    static sub(a: byte, b: byte, byteLength: number) : byte {
        return this.add(a, this.negate(b, byteLength));
    }

    static shiftLeft(a: byte) : byte {
        
        let copy = a.slice();
        copy.push(false);

        return copy;
    }

    static shiftRight(a: byte) : byte {
        
        let copy = a.slice();
        copy.pop();
        copy.unshift(false);

        return copy;
    }

    //Logic

    static not(a: bit) : bit {
        return !a;
    }

    static andMask(a: bits, mask: bits) : bits {
        let r = [];

        let m = Math.max(a.length, mask.length);

        let a_ = Utils.fillZeros(a, m);
        let mask_ = Utils.fillZeros(mask, m);

        for (let i = 0; i < m; i++)
            r.push(mask_[i] && a_[i]);

        return r;
    }
 
    static and(a: bit | bits, b: bit) : bit {
        return a && b;
    }

    static or(a: bit, b: bit) : bit {
        return a || b;
    }

    static nand(a: bit, b: bit) : bit {
        return !(a && b);
    }

    static nor(a: bit, b: bit) : bit {
        return !(a || b);
    }

    static xor(a: bit, b: bit) : bit {
        return (a || b) && !(a && b);
    }
}