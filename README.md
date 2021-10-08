

# 𓆤DBay 𓅗CMUdict


<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [𓆤DBay 𓅗CMUdict](#%F0%93%86%A4dbay-%F0%93%85%97cmudict)
  - [Data Sources](#data-sources)
  - [To Do](#to-do)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->


# 𓆤DBay 𓅗CMUdict

The 𓆤DBay 𓅗CMUdict takes the [ARPAbet](https://en.wikipedia.org/wiki/ARPABET) phonetic notations for the
126,689 (non-genitive) entries of [The CMU Pronouncing Dictionary
(CMUdict)](http://www.speech.cs.cmu.edu/cgi-bin/cmudict) and rewrites them in a number of ways:

* whereas the CMUdict originally used upper case [ARPAbet](https://en.wikipedia.org/wiki/ARPABET) notation,
  we convert those into lower case and correct a few details.
* From the rewritten ARPAbet, we derive a notation using the [International Phonetic Alphabet
  (IPA)](https://en.wikipedia.org/wiki/International_Phonetic_Alphabet), which is much more common and more
  readable. Since the CMUdict dataset does not contain any indicators for syllabification, we indicate
  stress by underlining stressed vowels with double and single lines for primary and secondary stress.
* By substituting IPA symbols with those of the [X-SAMPA](https://en.wikipedia.org/wiki/X-SAMPA)
  transliteration scheme, we get a notation that should be easier to type on most keyboards.

## Data Sources

* [CMUdict](http://www.speech.cs.cmu.edu/cgi-bin/cmudict)
* https://github.com/Alexir/CMUdict
* [ARPAbet](https://en.wikipedia.org/wiki/ARPABET)
* [X-SAMPA](https://en.wikipedia.org/wiki/X-SAMPA)

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
* **[–]** list all changes made to the original notation.
* **[–]** apply lower-casing and replacements right when reading original source
* **[–]** keep all transliterations in single table `trlats` so adding new schemes can be done w/out
  migration.
* **[–]** keep transliterations with vs transliterations without stree marking in two separate tables? Or
  better use a flag field.
* **[–]** remove / translate (into a field value) counter that indicates variants.



