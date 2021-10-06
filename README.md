

# 𓆤DBay 𓅗CMUdict


<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [𓆤DBay 𓅗CMUdict](#%F0%93%86%A4dbay-%F0%93%85%97cmudict)
  - [Data Source](#data-source)
  - [To Do](#to-do)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->


# 𓆤DBay 𓅗CMUdict

## Data Source

https://github.com/Alexir/CMUdict

## To Do

* **[–]** add table with phone occurrences
* **[+]** make entries lower case?
* **[+]** add column `arpabet` with spaces removed
* **[+]** add [X-SAMPA](https://en.wikipedia.org/wiki/X-SAMPA)
* **[+]** remove ambiguity (using stress marks?):
  * ```@` ɚ Xsampa-at'.png  r-coloured schwa  American English color ["kVl@`]```
  * ```3` ɝ   rhotic open-mid central unrounded vowel English [n3`s] (Gen.Am.)```
  * however, looking at the treatment of rhotic sounds in `arcturus`: `aa2 r k t er1 ah0 s`, `ɑɹktɝʌs` vs
    it would seem that the special symbol `ɝ` is not warranted: the first vowel in AmE *arctic* /ɑɹktɪk/
    is very much a rhotic vowel written with two consecutive symbols, so why would you write, say, *urge*
    as /ɝdʒ/ with a single symbol instead of as /ɜrdʒ/?

    ```
    arctic      │ aa1 r k t ih0 k         │ aa1rktih0k       │ Ar\ktIk    │ ɑɹktɪk
    arcturus    │ aa2 r k t uh1 r ah0 s   │ aa2rktuh1rah0s   │ Ar\ktUr\Vs │ ɑɹktʊɹʌs
    arcturus(1) │ aa2 r k t er1 ah0 s     │ aa2rkter1ah0s    │ Ar\kt3`Vs  │ ɑɹktɝʌs
    ```

  * therefore, rewrite `arpabet_s` `er(\d)` as `ah$1 r`



