# CocoVM
Coco is a small and flexible CPU emulator, you can choose the number of registers, the amount of RAM and the architecture (4bits, 8bits, 128bits...)

###Example
```asm
;fibonacci sequence

;prints fib(15)
MOV @4, #15 

;init data
MOV %0, #1
MOV %1, #1
MOV %2, #0
MOV %3, #2
JMP main

main:
INC %3
MOV %2, %0
ADD %0, %1
MOV %1, %2
CMP %3, @4
JNEQ main
OUT %0
HLT
           
```

##Addressing modes

Coco supports 3 addressing modes:

###register address (%)

to access the content of the nth register

```asm
MOV %0, %n
```

The 0th register ("%0") can be seen as the accumulator.

###RAM address (@)

to access the nth byte in RAM

```asm
MOV %0, @n
```

###immediate (#)

to use a numerical directly 

```asm
MOV %0, #1789
```
