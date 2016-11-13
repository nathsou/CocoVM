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

        return val - Math.abs((1 << (byteLength - 1)));
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