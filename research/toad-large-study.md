# TOAD Large Execution Study

This is a systematically selected partial transaction study, not a complete record of all TOAD activity or token holders.

`toad-large-study.json` contains all observed records and derived aggregates.

## Study Summary

{
  "coverage": {
    "startSlot": 438061664,
    "endSlot": 438429195,
    "sampling": {
      "method": "Two interleaved sets of 250 evenly spaced full-block slices; TOAD-mint account-key filter; stable signature-hash quota per slice; signature deduplication across phases",
      "targetMint": "A13oRB9FFaiUjfi6LdCg6p9ka1u8SfGkUFs4SKvPpump",
      "targetSlotStart": 438060926,
      "targetSlotEnd": 438429933,
      "baseRecords": 4358,
      "offsetRecords": 4412,
      "transactionsRetained": 8770,
      "selection": "Each phase is selected solely by slot position. Within each sampled block, all transactions whose account keys contain the TOAD mint are eligible and the first 32 after stable FNV-1a signature-hash ordering are retained. Receipt facts are not used for selection.",
      "phases": [
        {
          "method": "250 evenly spaced full-block slices; TOAD-mint account-key filter; stable signature-hash quota per slice",
          "targetMint": "A13oRB9FFaiUjfi6LdCg6p9ka1u8SfGkUFs4SKvPpump",
          "targetSlotStart": 438060926,
          "targetSlotEnd": 438429933,
          "sliceCount": 250,
          "quotaPerSlice": 32,
          "targetTransactions": 8000,
          "transactionsRetained": 4358,
          "selection": "Each slice is chosen only by slot position. Within its block, every transaction whose account keys contain the TOAD mint is eligible; the first 32 after stable FNV-1a signature-hash ordering are retained. Success, failure, signer, fee, programs, compute, token balances, and logs are not used for selection.",
          "slices": [
            {
              "slice": 1,
              "requestedCenterSlot": 438061664,
              "sampledBlockSlot": 438061664,
              "mintReferenceCandidates": 328,
              "retained": 32
            },
            {
              "slice": 2,
              "requestedCenterSlot": 438063140,
              "sampledBlockSlot": 438063140,
              "mintReferenceCandidates": 165,
              "retained": 32
            },
            {
              "slice": 3,
              "requestedCenterSlot": 438064616,
              "sampledBlockSlot": 438064616,
              "mintReferenceCandidates": 42,
              "retained": 32
            },
            {
              "slice": 4,
              "requestedCenterSlot": 438066092,
              "sampledBlockSlot": 438066092,
              "mintReferenceCandidates": 68,
              "retained": 32
            },
            {
              "slice": 5,
              "requestedCenterSlot": 438067568,
              "sampledBlockSlot": 438067568,
              "mintReferenceCandidates": 158,
              "retained": 32
            },
            {
              "slice": 6,
              "requestedCenterSlot": 438069044,
              "sampledBlockSlot": 438069044,
              "mintReferenceCandidates": 43,
              "retained": 32
            },
            {
              "slice": 7,
              "requestedCenterSlot": 438070520,
              "sampledBlockSlot": 438070520,
              "mintReferenceCandidates": 19,
              "retained": 19
            },
            {
              "slice": 8,
              "requestedCenterSlot": 438071996,
              "sampledBlockSlot": 438071996,
              "mintReferenceCandidates": 55,
              "retained": 32
            },
            {
              "slice": 9,
              "requestedCenterSlot": 438073472,
              "sampledBlockSlot": 438073472,
              "mintReferenceCandidates": 166,
              "retained": 32
            },
            {
              "slice": 10,
              "requestedCenterSlot": 438074948,
              "sampledBlockSlot": 438074948,
              "mintReferenceCandidates": 243,
              "retained": 32
            },
            {
              "slice": 11,
              "requestedCenterSlot": 438076424,
              "sampledBlockSlot": 438076424,
              "mintReferenceCandidates": 15,
              "retained": 15
            },
            {
              "slice": 12,
              "requestedCenterSlot": 438077900,
              "sampledBlockSlot": 438077900,
              "mintReferenceCandidates": 45,
              "retained": 32
            },
            {
              "slice": 13,
              "requestedCenterSlot": 438079376,
              "sampledBlockSlot": 438079376,
              "mintReferenceCandidates": 1,
              "retained": 1
            },
            {
              "slice": 14,
              "requestedCenterSlot": 438080852,
              "sampledBlockSlot": 438080852,
              "mintReferenceCandidates": 45,
              "retained": 32
            },
            {
              "slice": 15,
              "requestedCenterSlot": 438082328,
              "sampledBlockSlot": 438082328,
              "mintReferenceCandidates": 17,
              "retained": 17
            },
            {
              "slice": 16,
              "requestedCenterSlot": 438083804,
              "sampledBlockSlot": 438083804,
              "mintReferenceCandidates": 30,
              "retained": 30
            },
            {
              "slice": 17,
              "requestedCenterSlot": 438085280,
              "sampledBlockSlot": 438085280,
              "mintReferenceCandidates": 24,
              "retained": 24
            },
            {
              "slice": 18,
              "requestedCenterSlot": 438086756,
              "sampledBlockSlot": 438086756,
              "mintReferenceCandidates": 36,
              "retained": 32
            },
            {
              "slice": 19,
              "requestedCenterSlot": 438088233,
              "sampledBlockSlot": 438088233,
              "mintReferenceCandidates": 36,
              "retained": 32
            },
            {
              "slice": 20,
              "requestedCenterSlot": 438089709,
              "sampledBlockSlot": 438089709,
              "mintReferenceCandidates": 65,
              "retained": 32
            },
            {
              "slice": 21,
              "requestedCenterSlot": 438091185,
              "sampledBlockSlot": 438091185,
              "mintReferenceCandidates": 34,
              "retained": 32
            },
            {
              "slice": 22,
              "requestedCenterSlot": 438092661,
              "sampledBlockSlot": 438092661,
              "mintReferenceCandidates": 17,
              "retained": 17
            },
            {
              "slice": 23,
              "requestedCenterSlot": 438094137,
              "sampledBlockSlot": 438094137,
              "mintReferenceCandidates": 10,
              "retained": 10
            },
            {
              "slice": 24,
              "requestedCenterSlot": 438095613,
              "sampledBlockSlot": 438095613,
              "mintReferenceCandidates": 80,
              "retained": 32
            },
            {
              "slice": 25,
              "requestedCenterSlot": 438097089,
              "sampledBlockSlot": 438097089,
              "mintReferenceCandidates": 17,
              "retained": 17
            },
            {
              "slice": 26,
              "requestedCenterSlot": 438098565,
              "sampledBlockSlot": 438098565,
              "mintReferenceCandidates": 26,
              "retained": 26
            },
            {
              "slice": 27,
              "requestedCenterSlot": 438100041,
              "sampledBlockSlot": 438100041,
              "mintReferenceCandidates": 21,
              "retained": 21
            },
            {
              "slice": 28,
              "requestedCenterSlot": 438101517,
              "sampledBlockSlot": 438101517,
              "mintReferenceCandidates": 86,
              "retained": 32
            },
            {
              "slice": 29,
              "requestedCenterSlot": 438102993,
              "sampledBlockSlot": 438102993,
              "mintReferenceCandidates": 16,
              "retained": 16
            },
            {
              "slice": 30,
              "requestedCenterSlot": 438104469,
              "sampledBlockSlot": 438104469,
              "mintReferenceCandidates": 7,
              "retained": 7
            },
            {
              "slice": 31,
              "requestedCenterSlot": 438105945,
              "sampledBlockSlot": 438105945,
              "mintReferenceCandidates": 24,
              "retained": 24
            },
            {
              "slice": 32,
              "requestedCenterSlot": 438107421,
              "sampledBlockSlot": 438107421,
              "mintReferenceCandidates": 38,
              "retained": 32
            },
            {
              "slice": 33,
              "requestedCenterSlot": 438108897,
              "sampledBlockSlot": 438108897,
              "mintReferenceCandidates": 14,
              "retained": 14
            },
            {
              "slice": 34,
              "requestedCenterSlot": 438110373,
              "sampledBlockSlot": 438110373,
              "mintReferenceCandidates": 8,
              "retained": 8
            },
            {
              "slice": 35,
              "requestedCenterSlot": 438111849,
              "sampledBlockSlot": 438111849,
              "mintReferenceCandidates": 13,
              "retained": 13
            },
            {
              "slice": 36,
              "requestedCenterSlot": 438113325,
              "sampledBlockSlot": 438113325,
              "mintReferenceCandidates": 63,
              "retained": 32
            },
            {
              "slice": 37,
              "requestedCenterSlot": 438114801,
              "sampledBlockSlot": 438114801,
              "mintReferenceCandidates": 40,
              "retained": 32
            },
            {
              "slice": 38,
              "requestedCenterSlot": 438116277,
              "sampledBlockSlot": 438116277,
              "mintReferenceCandidates": 123,
              "retained": 32
            },
            {
              "slice": 39,
              "requestedCenterSlot": 438117753,
              "sampledBlockSlot": 438117753,
              "mintReferenceCandidates": 8,
              "retained": 8
            },
            {
              "slice": 40,
              "requestedCenterSlot": 438119229,
              "sampledBlockSlot": 438119229,
              "mintReferenceCandidates": 7,
              "retained": 7
            },
            {
              "slice": 41,
              "requestedCenterSlot": 438120705,
              "sampledBlockSlot": 438120705,
              "mintReferenceCandidates": 24,
              "retained": 24
            },
            {
              "slice": 42,
              "requestedCenterSlot": 438122181,
              "sampledBlockSlot": 438122181,
              "mintReferenceCandidates": 72,
              "retained": 32
            },
            {
              "slice": 43,
              "requestedCenterSlot": 438123657,
              "sampledBlockSlot": 438123657,
              "mintReferenceCandidates": 47,
              "retained": 32
            },
            {
              "slice": 44,
              "requestedCenterSlot": 438125133,
              "sampledBlockSlot": 438125133,
              "mintReferenceCandidates": 5,
              "retained": 5
            },
            {
              "slice": 45,
              "requestedCenterSlot": 438126609,
              "sampledBlockSlot": 438126609,
              "mintReferenceCandidates": 28,
              "retained": 28
            },
            {
              "slice": 46,
              "requestedCenterSlot": 438128085,
              "sampledBlockSlot": 438128085,
              "mintReferenceCandidates": 44,
              "retained": 32
            },
            {
              "slice": 47,
              "requestedCenterSlot": 438129561,
              "sampledBlockSlot": 438129561,
              "mintReferenceCandidates": 9,
              "retained": 9
            },
            {
              "slice": 48,
              "requestedCenterSlot": 438131037,
              "sampledBlockSlot": 438131037,
              "mintReferenceCandidates": 24,
              "retained": 24
            },
            {
              "slice": 49,
              "requestedCenterSlot": 438132513,
              "sampledBlockSlot": 438132513,
              "mintReferenceCandidates": 8,
              "retained": 8
            },
            {
              "slice": 50,
              "requestedCenterSlot": 438133989,
              "sampledBlockSlot": 438133989,
              "mintReferenceCandidates": 103,
              "retained": 32
            },
            {
              "slice": 51,
              "requestedCenterSlot": 438135465,
              "sampledBlockSlot": 438135465,
              "mintReferenceCandidates": 45,
              "retained": 32
            },
            {
              "slice": 52,
              "requestedCenterSlot": 438136941,
              "sampledBlockSlot": 438136941,
              "mintReferenceCandidates": 69,
              "retained": 32
            },
            {
              "slice": 53,
              "requestedCenterSlot": 438138417,
              "sampledBlockSlot": 438138417,
              "mintReferenceCandidates": 23,
              "retained": 23
            },
            {
              "slice": 54,
              "requestedCenterSlot": 438139893,
              "sampledBlockSlot": 438139893,
              "mintReferenceCandidates": 18,
              "retained": 18
            },
            {
              "slice": 55,
              "requestedCenterSlot": 438141370,
              "sampledBlockSlot": 438141370,
              "mintReferenceCandidates": 38,
              "retained": 32
            },
            {
              "slice": 56,
              "requestedCenterSlot": 438142846,
              "sampledBlockSlot": 438142846,
              "mintReferenceCandidates": 7,
              "retained": 7
            },
            {
              "slice": 57,
              "requestedCenterSlot": 438144322,
              "sampledBlockSlot": 438144322,
              "mintReferenceCandidates": 16,
              "retained": 16
            },
            {
              "slice": 58,
              "requestedCenterSlot": 438145798,
              "sampledBlockSlot": 438145798,
              "mintReferenceCandidates": 3,
              "retained": 3
            },
            {
              "slice": 59,
              "requestedCenterSlot": 438147274,
              "sampledBlockSlot": 438147274,
              "mintReferenceCandidates": 7,
              "retained": 7
            },
            {
              "slice": 60,
              "requestedCenterSlot": 438148750,
              "sampledBlockSlot": 438148750,
              "mintReferenceCandidates": 10,
              "retained": 10
            },
            {
              "slice": 61,
              "requestedCenterSlot": 438150226,
              "sampledBlockSlot": 438150226,
              "mintReferenceCandidates": 9,
              "retained": 9
            },
            {
              "slice": 62,
              "requestedCenterSlot": 438151702,
              "sampledBlockSlot": 438151702,
              "mintReferenceCandidates": 13,
              "retained": 13
            },
            {
              "slice": 63,
              "requestedCenterSlot": 438153178,
              "sampledBlockSlot": 438153178,
              "mintReferenceCandidates": 29,
              "retained": 29
            },
            {
              "slice": 64,
              "requestedCenterSlot": 438154654,
              "sampledBlockSlot": 438154654,
              "mintReferenceCandidates": 3,
              "retained": 3
            },
            {
              "slice": 65,
              "requestedCenterSlot": 438156130,
              "sampledBlockSlot": 438156130,
              "mintReferenceCandidates": 4,
              "retained": 4
            },
            {
              "slice": 66,
              "requestedCenterSlot": 438157606,
              "sampledBlockSlot": 438157606,
              "mintReferenceCandidates": 4,
              "retained": 4
            },
            {
              "slice": 67,
              "requestedCenterSlot": 438159082,
              "sampledBlockSlot": 438159082,
              "mintReferenceCandidates": 0,
              "retained": 0
            },
            {
              "slice": 68,
              "requestedCenterSlot": 438160558,
              "sampledBlockSlot": 438160558,
              "mintReferenceCandidates": 47,
              "retained": 32
            },
            {
              "slice": 69,
              "requestedCenterSlot": 438162034,
              "sampledBlockSlot": 438162034,
              "mintReferenceCandidates": 6,
              "retained": 6
            },
            {
              "slice": 70,
              "requestedCenterSlot": 438163510,
              "sampledBlockSlot": 438163510,
              "mintReferenceCandidates": 18,
              "retained": 18
            },
            {
              "slice": 71,
              "requestedCenterSlot": 438164986,
              "sampledBlockSlot": 438164986,
              "mintReferenceCandidates": 15,
              "retained": 15
            },
            {
              "slice": 72,
              "requestedCenterSlot": 438166462,
              "sampledBlockSlot": 438166462,
              "mintReferenceCandidates": 102,
              "retained": 32
            },
            {
              "slice": 73,
              "requestedCenterSlot": 438167938,
              "sampledBlockSlot": 438167938,
              "mintReferenceCandidates": 4,
              "retained": 4
            },
            {
              "slice": 74,
              "requestedCenterSlot": 438169414,
              "sampledBlockSlot": 438169414,
              "mintReferenceCandidates": 29,
              "retained": 29
            },
            {
              "slice": 75,
              "requestedCenterSlot": 438170890,
              "sampledBlockSlot": 438170890,
              "mintReferenceCandidates": 29,
              "retained": 29
            },
            {
              "slice": 76,
              "requestedCenterSlot": 438172366,
              "sampledBlockSlot": 438172366,
              "mintReferenceCandidates": 15,
              "retained": 15
            },
            {
              "slice": 77,
              "requestedCenterSlot": 438173842,
              "sampledBlockSlot": 438173842,
              "mintReferenceCandidates": 14,
              "retained": 14
            },
            {
              "slice": 78,
              "requestedCenterSlot": 438175318,
              "sampledBlockSlot": 438175318,
              "mintReferenceCandidates": 23,
              "retained": 23
            },
            {
              "slice": 79,
              "requestedCenterSlot": 438176794,
              "sampledBlockSlot": 438176794,
              "mintReferenceCandidates": 30,
              "retained": 30
            },
            {
              "slice": 80,
              "requestedCenterSlot": 438178270,
              "sampledBlockSlot": 438178270,
              "mintReferenceCandidates": 35,
              "retained": 32
            },
            {
              "slice": 81,
              "requestedCenterSlot": 438179746,
              "sampledBlockSlot": 438179746,
              "mintReferenceCandidates": 4,
              "retained": 4
            },
            {
              "slice": 82,
              "requestedCenterSlot": 438181222,
              "sampledBlockSlot": 438181222,
              "mintReferenceCandidates": 1,
              "retained": 1
            },
            {
              "slice": 83,
              "requestedCenterSlot": 438182698,
              "sampledBlockSlot": 438182698,
              "mintReferenceCandidates": 15,
              "retained": 15
            },
            {
              "slice": 84,
              "requestedCenterSlot": 438184174,
              "sampledBlockSlot": 438184174,
              "mintReferenceCandidates": 12,
              "retained": 12
            },
            {
              "slice": 85,
              "requestedCenterSlot": 438185650,
              "sampledBlockSlot": 438185650,
              "mintReferenceCandidates": 5,
              "retained": 5
            },
            {
              "slice": 86,
              "requestedCenterSlot": 438187126,
              "sampledBlockSlot": 438187126,
              "mintReferenceCandidates": 5,
              "retained": 5
            },
            {
              "slice": 87,
              "requestedCenterSlot": 438188602,
              "sampledBlockSlot": 438188602,
              "mintReferenceCandidates": 25,
              "retained": 25
            },
            {
              "slice": 88,
              "requestedCenterSlot": 438190078,
              "sampledBlockSlot": 438190078,
              "mintReferenceCandidates": 7,
              "retained": 7
            },
            {
              "slice": 89,
              "requestedCenterSlot": 438191554,
              "sampledBlockSlot": 438191554,
              "mintReferenceCandidates": 26,
              "retained": 26
            },
            {
              "slice": 90,
              "requestedCenterSlot": 438193031,
              "sampledBlockSlot": 438193031,
              "mintReferenceCandidates": 26,
              "retained": 26
            },
            {
              "slice": 91,
              "requestedCenterSlot": 438194507,
              "sampledBlockSlot": 438194507,
              "mintReferenceCandidates": 14,
              "retained": 14
            },
            {
              "slice": 92,
              "requestedCenterSlot": 438195983,
              "sampledBlockSlot": 438195983,
              "mintReferenceCandidates": 23,
              "retained": 23
            },
            {
              "slice": 93,
              "requestedCenterSlot": 438197459,
              "sampledBlockSlot": 438197459,
              "mintReferenceCandidates": 4,
              "retained": 4
            },
            {
              "slice": 94,
              "requestedCenterSlot": 438198935,
              "sampledBlockSlot": 438198935,
              "mintReferenceCandidates": 3,
              "retained": 3
            },
            {
              "slice": 95,
              "requestedCenterSlot": 438200411,
              "sampledBlockSlot": 438200411,
              "mintReferenceCandidates": 10,
              "retained": 10
            },
            {
              "slice": 96,
              "requestedCenterSlot": 438201887,
              "sampledBlockSlot": 438201887,
              "mintReferenceCandidates": 60,
              "retained": 32
            },
            {
              "slice": 97,
              "requestedCenterSlot": 438203363,
              "sampledBlockSlot": 438203363,
              "mintReferenceCandidates": 44,
              "retained": 32
            },
            {
              "slice": 98,
              "requestedCenterSlot": 438204839,
              "sampledBlockSlot": 438204839,
              "mintReferenceCandidates": 16,
              "retained": 16
            },
            {
              "slice": 99,
              "requestedCenterSlot": 438206315,
              "sampledBlockSlot": 438206315,
              "mintReferenceCandidates": 8,
              "retained": 8
            },
            {
              "slice": 100,
              "requestedCenterSlot": 438207791,
              "sampledBlockSlot": 438207791,
              "mintReferenceCandidates": 14,
              "retained": 14
            },
            {
              "slice": 101,
              "requestedCenterSlot": 438209267,
              "sampledBlockSlot": 438209267,
              "mintReferenceCandidates": 9,
              "retained": 9
            },
            {
              "slice": 102,
              "requestedCenterSlot": 438210743,
              "sampledBlockSlot": 438210743,
              "mintReferenceCandidates": 21,
              "retained": 21
            },
            {
              "slice": 103,
              "requestedCenterSlot": 438212219,
              "sampledBlockSlot": 438212219,
              "mintReferenceCandidates": 18,
              "retained": 18
            },
            {
              "slice": 104,
              "requestedCenterSlot": 438213695,
              "sampledBlockSlot": 438213695,
              "mintReferenceCandidates": 40,
              "retained": 32
            },
            {
              "slice": 105,
              "requestedCenterSlot": 438215171,
              "sampledBlockSlot": 438215171,
              "mintReferenceCandidates": 60,
              "retained": 32
            },
            {
              "slice": 106,
              "requestedCenterSlot": 438216647,
              "sampledBlockSlot": 438216647,
              "mintReferenceCandidates": 0,
              "retained": 0
            },
            {
              "slice": 107,
              "requestedCenterSlot": 438218123,
              "sampledBlockSlot": 438218123,
              "mintReferenceCandidates": 56,
              "retained": 32
            },
            {
              "slice": 108,
              "requestedCenterSlot": 438219599,
              "sampledBlockSlot": 438219599,
              "mintReferenceCandidates": 11,
              "retained": 11
            },
            {
              "slice": 109,
              "requestedCenterSlot": 438221075,
              "sampledBlockSlot": 438221075,
              "mintReferenceCandidates": 49,
              "retained": 32
            },
            {
              "slice": 110,
              "requestedCenterSlot": 438222551,
              "sampledBlockSlot": 438222551,
              "mintReferenceCandidates": 45,
              "retained": 32
            },
            {
              "slice": 111,
              "requestedCenterSlot": 438224027,
              "sampledBlockSlot": 438224027,
              "mintReferenceCandidates": 5,
              "retained": 5
            },
            {
              "slice": 112,
              "requestedCenterSlot": 438225503,
              "sampledBlockSlot": 438225503,
              "mintReferenceCandidates": 128,
              "retained": 32
            },
            {
              "slice": 113,
              "requestedCenterSlot": 438226979,
              "sampledBlockSlot": 438226979,
              "mintReferenceCandidates": 2,
              "retained": 2
            },
            {
              "slice": 114,
              "requestedCenterSlot": 438228455,
              "sampledBlockSlot": 438228455,
              "mintReferenceCandidates": 11,
              "retained": 11
            },
            {
              "slice": 115,
              "requestedCenterSlot": 438229931,
              "sampledBlockSlot": 438229931,
              "mintReferenceCandidates": 18,
              "retained": 18
            },
            {
              "slice": 116,
              "requestedCenterSlot": 438231407,
              "sampledBlockSlot": 438231407,
              "mintReferenceCandidates": 9,
              "retained": 9
            },
            {
              "slice": 117,
              "requestedCenterSlot": 438232883,
              "sampledBlockSlot": 438232883,
              "mintReferenceCandidates": 14,
              "retained": 14
            },
            {
              "slice": 118,
              "requestedCenterSlot": 438234359,
              "sampledBlockSlot": 438234359,
              "mintReferenceCandidates": 4,
              "retained": 4
            },
            {
              "slice": 119,
              "requestedCenterSlot": 438235835,
              "sampledBlockSlot": 438235835,
              "mintReferenceCandidates": 71,
              "retained": 32
            },
            {
              "slice": 120,
              "requestedCenterSlot": 438237311,
              "sampledBlockSlot": 438237311,
              "mintReferenceCandidates": 26,
              "retained": 26
            },
            {
              "slice": 121,
              "requestedCenterSlot": 438238787,
              "sampledBlockSlot": 438238787,
              "mintReferenceCandidates": 20,
              "retained": 20
            },
            {
              "slice": 122,
              "requestedCenterSlot": 438240263,
              "sampledBlockSlot": 438240263,
              "mintReferenceCandidates": 4,
              "retained": 4
            },
            {
              "slice": 123,
              "requestedCenterSlot": 438241739,
              "sampledBlockSlot": 438241739,
              "mintReferenceCandidates": 3,
              "retained": 3
            },
            {
              "slice": 124,
              "requestedCenterSlot": 438243215,
              "sampledBlockSlot": 438243215,
              "mintReferenceCandidates": 51,
              "retained": 32
            },
            {
              "slice": 125,
              "requestedCenterSlot": 438244691,
              "sampledBlockSlot": 438244691,
              "mintReferenceCandidates": 22,
              "retained": 22
            },
            {
              "slice": 126,
              "requestedCenterSlot": 438246168,
              "sampledBlockSlot": 438246168,
              "mintReferenceCandidates": 31,
              "retained": 31
            },
            {
              "slice": 127,
              "requestedCenterSlot": 438247644,
              "sampledBlockSlot": 438247644,
              "mintReferenceCandidates": 7,
              "retained": 7
            },
            {
              "slice": 128,
              "requestedCenterSlot": 438249120,
              "sampledBlockSlot": 438249120,
              "mintReferenceCandidates": 13,
              "retained": 13
            },
            {
              "slice": 129,
              "requestedCenterSlot": 438250596,
              "sampledBlockSlot": 438250596,
              "mintReferenceCandidates": 1,
              "retained": 1
            },
            {
              "slice": 130,
              "requestedCenterSlot": 438252072,
              "sampledBlockSlot": 438252072,
              "mintReferenceCandidates": 69,
              "retained": 32
            },
            {
              "slice": 131,
              "requestedCenterSlot": 438253548,
              "sampledBlockSlot": 438253548,
              "mintReferenceCandidates": 7,
              "retained": 7
            },
            {
              "slice": 132,
              "requestedCenterSlot": 438255024,
              "sampledBlockSlot": 438255024,
              "mintReferenceCandidates": 42,
              "retained": 32
            },
            {
              "slice": 133,
              "requestedCenterSlot": 438256500,
              "sampledBlockSlot": 438256500,
              "mintReferenceCandidates": 0,
              "retained": 0
            },
            {
              "slice": 134,
              "requestedCenterSlot": 438257976,
              "sampledBlockSlot": 438257976,
              "mintReferenceCandidates": 2,
              "retained": 2
            },
            {
              "slice": 135,
              "requestedCenterSlot": 438259452,
              "sampledBlockSlot": 438259452,
              "mintReferenceCandidates": 0,
              "retained": 0
            },
            {
              "slice": 136,
              "requestedCenterSlot": 438260928,
              "sampledBlockSlot": 438260928,
              "mintReferenceCandidates": 210,
              "retained": 32
            },
            {
              "slice": 137,
              "requestedCenterSlot": 438262404,
              "sampledBlockSlot": 438262404,
              "mintReferenceCandidates": 14,
              "retained": 14
            },
            {
              "slice": 138,
              "requestedCenterSlot": 438263880,
              "sampledBlockSlot": 438263880,
              "mintReferenceCandidates": 6,
              "retained": 6
            },
            {
              "slice": 139,
              "requestedCenterSlot": 438265356,
              "sampledBlockSlot": 438265356,
              "mintReferenceCandidates": 32,
              "retained": 32
            },
            {
              "slice": 140,
              "requestedCenterSlot": 438266832,
              "sampledBlockSlot": 438266832,
              "mintReferenceCandidates": 1,
              "retained": 1
            },
            {
              "slice": 141,
              "requestedCenterSlot": 438268308,
              "sampledBlockSlot": 438268308,
              "mintReferenceCandidates": 235,
              "retained": 32
            },
            {
              "slice": 142,
              "requestedCenterSlot": 438269784,
              "sampledBlockSlot": 438269784,
              "mintReferenceCandidates": 59,
              "retained": 32
            },
            {
              "slice": 143,
              "requestedCenterSlot": 438271260,
              "sampledBlockSlot": 438271260,
              "mintReferenceCandidates": 6,
              "retained": 6
            },
            {
              "slice": 144,
              "requestedCenterSlot": 438272736,
              "sampledBlockSlot": 438272736,
              "mintReferenceCandidates": 49,
              "retained": 32
            },
            {
              "slice": 145,
              "requestedCenterSlot": 438274212,
              "sampledBlockSlot": 438274212,
              "mintReferenceCandidates": 3,
              "retained": 3
            },
            {
              "slice": 146,
              "requestedCenterSlot": 438275688,
              "sampledBlockSlot": 438275688,
              "mintReferenceCandidates": 61,
              "retained": 32
            },
            {
              "slice": 147,
              "requestedCenterSlot": 438277164,
              "sampledBlockSlot": 438277164,
              "mintReferenceCandidates": 11,
              "retained": 11
            },
            {
              "slice": 148,
              "requestedCenterSlot": 438278640,
              "sampledBlockSlot": 438278640,
              "mintReferenceCandidates": 3,
              "retained": 3
            },
            {
              "slice": 149,
              "requestedCenterSlot": 438280116,
              "sampledBlockSlot": 438280116,
              "mintReferenceCandidates": 131,
              "retained": 32
            },
            {
              "slice": 150,
              "requestedCenterSlot": 438281592,
              "sampledBlockSlot": 438281592,
              "mintReferenceCandidates": 13,
              "retained": 13
            },
            {
              "slice": 151,
              "requestedCenterSlot": 438283068,
              "sampledBlockSlot": 438283068,
              "mintReferenceCandidates": 109,
              "retained": 32
            },
            {
              "slice": 152,
              "requestedCenterSlot": 438284544,
              "sampledBlockSlot": 438284544,
              "mintReferenceCandidates": 8,
              "retained": 8
            },
            {
              "slice": 153,
              "requestedCenterSlot": 438286020,
              "sampledBlockSlot": 438286020,
              "mintReferenceCandidates": 85,
              "retained": 32
            },
            {
              "slice": 154,
              "requestedCenterSlot": 438287496,
              "sampledBlockSlot": 438287496,
              "mintReferenceCandidates": 12,
              "retained": 12
            },
            {
              "slice": 155,
              "requestedCenterSlot": 438288972,
              "sampledBlockSlot": 438288972,
              "mintReferenceCandidates": 11,
              "retained": 11
            },
            {
              "slice": 156,
              "requestedCenterSlot": 438290448,
              "sampledBlockSlot": 438290448,
              "mintReferenceCandidates": 0,
              "retained": 0
            },
            {
              "slice": 157,
              "requestedCenterSlot": 438291924,
              "sampledBlockSlot": 438291924,
              "mintReferenceCandidates": 207,
              "retained": 32
            },
            {
              "slice": 158,
              "requestedCenterSlot": 438293400,
              "sampledBlockSlot": 438293400,
              "mintReferenceCandidates": 213,
              "retained": 32
            },
            {
              "slice": 159,
              "requestedCenterSlot": 438294876,
              "sampledBlockSlot": 438294876,
              "mintReferenceCandidates": 185,
              "retained": 32
            },
            {
              "slice": 160,
              "requestedCenterSlot": 438296352,
              "sampledBlockSlot": 438296352,
              "mintReferenceCandidates": 130,
              "retained": 32
            },
            {
              "slice": 161,
              "requestedCenterSlot": 438297828,
              "sampledBlockSlot": 438297828,
              "mintReferenceCandidates": 111,
              "retained": 32
            },
            {
              "slice": 162,
              "requestedCenterSlot": 438299305,
              "sampledBlockSlot": 438299305,
              "mintReferenceCandidates": 8,
              "retained": 8
            },
            {
              "slice": 163,
              "requestedCenterSlot": 438300781,
              "sampledBlockSlot": 438300781,
              "mintReferenceCandidates": 26,
              "retained": 26
            },
            {
              "slice": 164,
              "requestedCenterSlot": 438302257,
              "sampledBlockSlot": 438302257,
              "mintReferenceCandidates": 6,
              "retained": 6
            },
            {
              "slice": 165,
              "requestedCenterSlot": 438303733,
              "sampledBlockSlot": 438303733,
              "mintReferenceCandidates": 11,
              "retained": 11
            },
            {
              "slice": 166,
              "requestedCenterSlot": 438305209,
              "sampledBlockSlot": 438305209,
              "mintReferenceCandidates": 12,
              "retained": 12
            },
            {
              "slice": 167,
              "requestedCenterSlot": 438306685,
              "sampledBlockSlot": 438306685,
              "mintReferenceCandidates": 5,
              "retained": 5
            },
            {
              "slice": 168,
              "requestedCenterSlot": 438308161,
              "sampledBlockSlot": 438308161,
              "mintReferenceCandidates": 105,
              "retained": 32
            },
            {
              "slice": 169,
              "requestedCenterSlot": 438309637,
              "sampledBlockSlot": 438309637,
              "mintReferenceCandidates": 9,
              "retained": 9
            },
            {
              "slice": 170,
              "requestedCenterSlot": 438311113,
              "sampledBlockSlot": 438311113,
              "mintReferenceCandidates": 145,
              "retained": 32
            },
            {
              "slice": 171,
              "requestedCenterSlot": 438312589,
              "sampledBlockSlot": 438312589,
              "mintReferenceCandidates": 44,
              "retained": 32
            },
            {
              "slice": 172,
              "requestedCenterSlot": 438314065,
              "sampledBlockSlot": 438314065,
              "mintReferenceCandidates": 32,
              "retained": 32
            },
            {
              "slice": 173,
              "requestedCenterSlot": 438315541,
              "sampledBlockSlot": 438315541,
              "mintReferenceCandidates": 16,
              "retained": 16
            },
            {
              "slice": 174,
              "requestedCenterSlot": 438317017,
              "sampledBlockSlot": 438317017,
              "mintReferenceCandidates": 9,
              "retained": 9
            },
            {
              "slice": 175,
              "requestedCenterSlot": 438318493,
              "sampledBlockSlot": 438318493,
              "mintReferenceCandidates": 4,
              "retained": 4
            },
            {
              "slice": 176,
              "requestedCenterSlot": 438319969,
              "sampledBlockSlot": 438319969,
              "mintReferenceCandidates": 1,
              "retained": 1
            },
            {
              "slice": 177,
              "requestedCenterSlot": 438321445,
              "sampledBlockSlot": 438321445,
              "mintReferenceCandidates": 11,
              "retained": 11
            },
            {
              "slice": 178,
              "requestedCenterSlot": 438322921,
              "sampledBlockSlot": 438322921,
              "mintReferenceCandidates": 79,
              "retained": 32
            },
            {
              "slice": 179,
              "requestedCenterSlot": 438324397,
              "sampledBlockSlot": 438324397,
              "mintReferenceCandidates": 60,
              "retained": 32
            },
            {
              "slice": 180,
              "requestedCenterSlot": 438325873,
              "sampledBlockSlot": 438325873,
              "mintReferenceCandidates": 37,
              "retained": 32
            },
            {
              "slice": 181,
              "requestedCenterSlot": 438327349,
              "sampledBlockSlot": 438327349,
              "mintReferenceCandidates": 41,
              "retained": 32
            },
            {
              "slice": 182,
              "requestedCenterSlot": 438328825,
              "sampledBlockSlot": 438328825,
              "mintReferenceCandidates": 18,
              "retained": 18
            },
            {
              "slice": 183,
              "requestedCenterSlot": 438330301,
              "sampledBlockSlot": 438330301,
              "mintReferenceCandidates": 8,
              "retained": 8
            },
            {
              "slice": 184,
              "requestedCenterSlot": 438331777,
              "sampledBlockSlot": 438331777,
              "mintReferenceCandidates": 0,
              "retained": 0
            },
            {
              "slice": 185,
              "requestedCenterSlot": 438333253,
              "sampledBlockSlot": 438333253,
              "mintReferenceCandidates": 192,
              "retained": 32
            },
            {
              "slice": 186,
              "requestedCenterSlot": 438334729,
              "sampledBlockSlot": 438334729,
              "mintReferenceCandidates": 74,
              "retained": 32
            },
            {
              "slice": 187,
              "requestedCenterSlot": 438336205,
              "sampledBlockSlot": 438336205,
              "mintReferenceCandidates": 15,
              "retained": 15
            },
            {
              "slice": 188,
              "requestedCenterSlot": 438337681,
              "sampledBlockSlot": 438337681,
              "mintReferenceCandidates": 15,
              "retained": 15
            },
            {
              "slice": 189,
              "requestedCenterSlot": 438339157,
              "sampledBlockSlot": 438339157,
              "mintReferenceCandidates": 5,
              "retained": 5
            },
            {
              "slice": 190,
              "requestedCenterSlot": 438340633,
              "sampledBlockSlot": 438340633,
              "mintReferenceCandidates": 0,
              "retained": 0
            },
            {
              "slice": 191,
              "requestedCenterSlot": 438342109,
              "sampledBlockSlot": 438342109,
              "mintReferenceCandidates": 13,
              "retained": 13
            },
            {
              "slice": 192,
              "requestedCenterSlot": 438343585,
              "sampledBlockSlot": 438343585,
              "mintReferenceCandidates": 16,
              "retained": 16
            },
            {
              "slice": 193,
              "requestedCenterSlot": 438345061,
              "sampledBlockSlot": 438345061,
              "mintReferenceCandidates": 1,
              "retained": 1
            },
            {
              "slice": 194,
              "requestedCenterSlot": 438346537,
              "sampledBlockSlot": 438346537,
              "mintReferenceCandidates": 4,
              "retained": 4
            },
            {
              "slice": 195,
              "requestedCenterSlot": 438348013,
              "sampledBlockSlot": 438348013,
              "mintReferenceCandidates": 3,
              "retained": 3
            },
            {
              "slice": 196,
              "requestedCenterSlot": 438349489,
              "sampledBlockSlot": 438349489,
              "mintReferenceCandidates": 24,
              "retained": 24
            },
            {
              "slice": 197,
              "requestedCenterSlot": 438350966,
              "sampledBlockSlot": 438350966,
              "mintReferenceCandidates": 1,
              "retained": 1
            },
            {
              "slice": 198,
              "requestedCenterSlot": 438352442,
              "sampledBlockSlot": 438352442,
              "mintReferenceCandidates": 42,
              "retained": 32
            },
            {
              "slice": 199,
              "requestedCenterSlot": 438353918,
              "sampledBlockSlot": 438353918,
              "mintReferenceCandidates": 9,
              "retained": 9
            },
            {
              "slice": 200,
              "requestedCenterSlot": 438355394,
              "sampledBlockSlot": 438355394,
              "mintReferenceCandidates": 14,
              "retained": 14
            },
            {
              "slice": 201,
              "requestedCenterSlot": 438356870,
              "sampledBlockSlot": 438356870,
              "mintReferenceCandidates": 18,
              "retained": 18
            },
            {
              "slice": 202,
              "requestedCenterSlot": 438358346,
              "sampledBlockSlot": 438358346,
              "mintReferenceCandidates": 3,
              "retained": 3
            },
            {
              "slice": 203,
              "requestedCenterSlot": 438359822,
              "sampledBlockSlot": 438359822,
              "mintReferenceCandidates": 33,
              "retained": 32
            },
            {
              "slice": 204,
              "requestedCenterSlot": 438361298,
              "sampledBlockSlot": 438361298,
              "mintReferenceCandidates": 10,
              "retained": 10
            },
            {
              "slice": 205,
              "requestedCenterSlot": 438362774,
              "sampledBlockSlot": 438362774,
              "mintReferenceCandidates": 26,
              "retained": 26
            },
            {
              "slice": 206,
              "requestedCenterSlot": 438364250,
              "sampledBlockSlot": 438364250,
              "mintReferenceCandidates": 16,
              "retained": 16
            },
            {
              "slice": 207,
              "requestedCenterSlot": 438365726,
              "sampledBlockSlot": 438365726,
              "mintReferenceCandidates": 93,
              "retained": 32
            },
            {
              "slice": 208,
              "requestedCenterSlot": 438367202,
              "sampledBlockSlot": 438367202,
              "mintReferenceCandidates": 82,
              "retained": 32
            },
            {
              "slice": 209,
              "requestedCenterSlot": 438368678,
              "sampledBlockSlot": 438368678,
              "mintReferenceCandidates": 2,
              "retained": 2
            },
            {
              "slice": 210,
              "requestedCenterSlot": 438370154,
              "sampledBlockSlot": 438370154,
              "mintReferenceCandidates": 82,
              "retained": 32
            },
            {
              "slice": 211,
              "requestedCenterSlot": 438371630,
              "sampledBlockSlot": 438371630,
              "mintReferenceCandidates": 9,
              "retained": 9
            },
            {
              "slice": 212,
              "requestedCenterSlot": 438373106,
              "sampledBlockSlot": 438373106,
              "mintReferenceCandidates": 6,
              "retained": 6
            },
            {
              "slice": 213,
              "requestedCenterSlot": 438374582,
              "sampledBlockSlot": 438374582,
              "mintReferenceCandidates": 8,
              "retained": 8
            },
            {
              "slice": 214,
              "requestedCenterSlot": 438376058,
              "sampledBlockSlot": 438376058,
              "mintReferenceCandidates": 82,
              "retained": 32
            },
            {
              "slice": 215,
              "requestedCenterSlot": 438377534,
              "sampledBlockSlot": 438377534,
              "mintReferenceCandidates": 68,
              "retained": 32
            },
            {
              "slice": 216,
              "requestedCenterSlot": 438379010,
              "sampledBlockSlot": 438379010,
              "mintReferenceCandidates": 10,
              "retained": 10
            },
            {
              "slice": 217,
              "requestedCenterSlot": 438380486,
              "sampledBlockSlot": 438380486,
              "mintReferenceCandidates": 1,
              "retained": 1
            },
            {
              "slice": 218,
              "requestedCenterSlot": 438381962,
              "sampledBlockSlot": 438381962,
              "mintReferenceCandidates": 1,
              "retained": 1
            },
            {
              "slice": 219,
              "requestedCenterSlot": 438383438,
              "sampledBlockSlot": 438383438,
              "mintReferenceCandidates": 12,
              "retained": 12
            },
            {
              "slice": 220,
              "requestedCenterSlot": 438384914,
              "sampledBlockSlot": 438384914,
              "mintReferenceCandidates": 0,
              "retained": 0
            },
            {
              "slice": 221,
              "requestedCenterSlot": 438386390,
              "sampledBlockSlot": 438386390,
              "mintReferenceCandidates": 0,
              "retained": 0
            },
            {
              "slice": 222,
              "requestedCenterSlot": 438387866,
              "sampledBlockSlot": 438387866,
              "mintReferenceCandidates": 4,
              "retained": 4
            },
            {
              "slice": 223,
              "requestedCenterSlot": 438389342,
              "sampledBlockSlot": 438389342,
              "mintReferenceCandidates": 2,
              "retained": 2
            },
            {
              "slice": 224,
              "requestedCenterSlot": 438390818,
              "sampledBlockSlot": 438390818,
              "mintReferenceCandidates": 0,
              "retained": 0
            },
            {
              "slice": 225,
              "requestedCenterSlot": 438392294,
              "sampledBlockSlot": 438392294,
              "mintReferenceCandidates": 1,
              "retained": 1
            },
            {
              "slice": 226,
              "requestedCenterSlot": 438393770,
              "sampledBlockSlot": 438393770,
              "mintReferenceCandidates": 1,
              "retained": 1
            },
            {
              "slice": 227,
              "requestedCenterSlot": 438395246,
              "sampledBlockSlot": 438395246,
              "mintReferenceCandidates": 56,
              "retained": 32
            },
            {
              "slice": 228,
              "requestedCenterSlot": 438396722,
              "sampledBlockSlot": 438396722,
              "mintReferenceCandidates": 8,
              "retained": 8
            },
            {
              "slice": 229,
              "requestedCenterSlot": 438398198,
              "sampledBlockSlot": 438398198,
              "mintReferenceCandidates": 16,
              "retained": 16
            },
            {
              "slice": 230,
              "requestedCenterSlot": 438399674,
              "sampledBlockSlot": 438399674,
              "mintReferenceCandidates": 13,
              "retained": 13
            },
            {
              "slice": 231,
              "requestedCenterSlot": 438401150,
              "sampledBlockSlot": 438401150,
              "mintReferenceCandidates": 5,
              "retained": 5
            },
            {
              "slice": 232,
              "requestedCenterSlot": 438402626,
              "sampledBlockSlot": 438402626,
              "mintReferenceCandidates": 4,
              "retained": 4
            },
            {
              "slice": 233,
              "requestedCenterSlot": 438404103,
              "sampledBlockSlot": 438404103,
              "mintReferenceCandidates": 2,
              "retained": 2
            },
            {
              "slice": 234,
              "requestedCenterSlot": 438405579,
              "sampledBlockSlot": 438405579,
              "mintReferenceCandidates": 59,
              "retained": 32
            },
            {
              "slice": 235,
              "requestedCenterSlot": 438407055,
              "sampledBlockSlot": 438407055,
              "mintReferenceCandidates": 22,
              "retained": 22
            },
            {
              "slice": 236,
              "requestedCenterSlot": 438408531,
              "sampledBlockSlot": 438408531,
              "mintReferenceCandidates": 20,
              "retained": 20
            },
            {
              "slice": 237,
              "requestedCenterSlot": 438410007,
              "sampledBlockSlot": 438410007,
              "mintReferenceCandidates": 91,
              "retained": 32
            },
            {
              "slice": 238,
              "requestedCenterSlot": 438411483,
              "sampledBlockSlot": 438411483,
              "mintReferenceCandidates": 26,
              "retained": 26
            },
            {
              "slice": 239,
              "requestedCenterSlot": 438412959,
              "sampledBlockSlot": 438412959,
              "mintReferenceCandidates": 6,
              "retained": 6
            },
            {
              "slice": 240,
              "requestedCenterSlot": 438414435,
              "sampledBlockSlot": 438414435,
              "mintReferenceCandidates": 3,
              "retained": 3
            },
            {
              "slice": 241,
              "requestedCenterSlot": 438415911,
              "sampledBlockSlot": 438415911,
              "mintReferenceCandidates": 3,
              "retained": 3
            },
            {
              "slice": 242,
              "requestedCenterSlot": 438417387,
              "sampledBlockSlot": 438417387,
              "mintReferenceCandidates": 6,
              "retained": 6
            },
            {
              "slice": 243,
              "requestedCenterSlot": 438418863,
              "sampledBlockSlot": 438418863,
              "mintReferenceCandidates": 6,
              "retained": 6
            },
            {
              "slice": 244,
              "requestedCenterSlot": 438420339,
              "sampledBlockSlot": 438420339,
              "mintReferenceCandidates": 18,
              "retained": 18
            },
            {
              "slice": 245,
              "requestedCenterSlot": 438421815,
              "sampledBlockSlot": 438421815,
              "mintReferenceCandidates": 16,
              "retained": 16
            },
            {
              "slice": 246,
              "requestedCenterSlot": 438423291,
              "sampledBlockSlot": 438423291,
              "mintReferenceCandidates": 10,
              "retained": 10
            },
            {
              "slice": 247,
              "requestedCenterSlot": 438424767,
              "sampledBlockSlot": 438424767,
              "mintReferenceCandidates": 5,
              "retained": 5
            },
            {
              "slice": 248,
              "requestedCenterSlot": 438426243,
              "sampledBlockSlot": 438426243,
              "mintReferenceCandidates": 0,
              "retained": 0
            },
            {
              "slice": 249,
              "requestedCenterSlot": 438427719,
              "sampledBlockSlot": 438427719,
              "mintReferenceCandidates": 15,
              "retained": 15
            },
            {
              "slice": 250,
              "requestedCenterSlot": 438429195,
              "sampledBlockSlot": 438429195,
              "mintReferenceCandidates": 11,
              "retained": 11
            }
          ]
        },
        {
          "method": "250 offset full-block slices; TOAD-mint account-key filter; stable signature-hash quota per slice",
          "targetMint": "A13oRB9FFaiUjfi6LdCg6p9ka1u8SfGkUFs4SKvPpump",
          "targetSlotStart": 438060926,
          "targetSlotEnd": 438429933,
          "sliceCount": 250,
          "quotaPerSlice": 32,
          "targetTransactions": 8000,
          "transactionsRetained": 4412,
          "selection": "Each slice is chosen only by slot position. Within its block, every transaction whose account keys contain the TOAD mint is eligible; the first 32 after stable FNV-1a signature-hash ordering are retained. Success, failure, signer, fee, programs, compute, token balances, and logs are not used for selection.",
          "slices": [
            {
              "slice": 1,
              "requestedCenterSlot": 438062396,
              "sampledBlockSlot": 438062396,
              "mintReferenceCandidates": 402,
              "retained": 32
            },
            {
              "slice": 2,
              "requestedCenterSlot": 438063866,
              "sampledBlockSlot": 438063866,
              "mintReferenceCandidates": 560,
              "retained": 32
            },
            {
              "slice": 3,
              "requestedCenterSlot": 438065336,
              "sampledBlockSlot": 438065336,
              "mintReferenceCandidates": 46,
              "retained": 32
            },
            {
              "slice": 4,
              "requestedCenterSlot": 438066807,
              "sampledBlockSlot": 438066807,
              "mintReferenceCandidates": 305,
              "retained": 32
            },
            {
              "slice": 5,
              "requestedCenterSlot": 438068277,
              "sampledBlockSlot": 438068277,
              "mintReferenceCandidates": 23,
              "retained": 23
            },
            {
              "slice": 6,
              "requestedCenterSlot": 438069747,
              "sampledBlockSlot": 438069747,
              "mintReferenceCandidates": 147,
              "retained": 32
            },
            {
              "slice": 7,
              "requestedCenterSlot": 438071217,
              "sampledBlockSlot": 438071217,
              "mintReferenceCandidates": 272,
              "retained": 32
            },
            {
              "slice": 8,
              "requestedCenterSlot": 438072687,
              "sampledBlockSlot": 438072687,
              "mintReferenceCandidates": 20,
              "retained": 20
            },
            {
              "slice": 9,
              "requestedCenterSlot": 438074157,
              "sampledBlockSlot": 438074157,
              "mintReferenceCandidates": 63,
              "retained": 32
            },
            {
              "slice": 10,
              "requestedCenterSlot": 438075627,
              "sampledBlockSlot": 438075627,
              "mintReferenceCandidates": 27,
              "retained": 27
            },
            {
              "slice": 11,
              "requestedCenterSlot": 438077098,
              "sampledBlockSlot": 438077098,
              "mintReferenceCandidates": 69,
              "retained": 32
            },
            {
              "slice": 12,
              "requestedCenterSlot": 438078568,
              "sampledBlockSlot": 438078568,
              "mintReferenceCandidates": 39,
              "retained": 32
            },
            {
              "slice": 13,
              "requestedCenterSlot": 438080038,
              "sampledBlockSlot": 438080038,
              "mintReferenceCandidates": 22,
              "retained": 22
            },
            {
              "slice": 14,
              "requestedCenterSlot": 438081508,
              "sampledBlockSlot": 438081508,
              "mintReferenceCandidates": 12,
              "retained": 12
            },
            {
              "slice": 15,
              "requestedCenterSlot": 438082978,
              "sampledBlockSlot": 438082978,
              "mintReferenceCandidates": 72,
              "retained": 32
            },
            {
              "slice": 16,
              "requestedCenterSlot": 438084448,
              "sampledBlockSlot": 438084448,
              "mintReferenceCandidates": 15,
              "retained": 15
            },
            {
              "slice": 17,
              "requestedCenterSlot": 438085919,
              "sampledBlockSlot": 438085919,
              "mintReferenceCandidates": 73,
              "retained": 32
            },
            {
              "slice": 18,
              "requestedCenterSlot": 438087389,
              "sampledBlockSlot": 438087389,
              "mintReferenceCandidates": 15,
              "retained": 15
            },
            {
              "slice": 19,
              "requestedCenterSlot": 438088859,
              "sampledBlockSlot": 438088859,
              "mintReferenceCandidates": 67,
              "retained": 32
            },
            {
              "slice": 20,
              "requestedCenterSlot": 438090329,
              "sampledBlockSlot": 438090329,
              "mintReferenceCandidates": 13,
              "retained": 13
            },
            {
              "slice": 21,
              "requestedCenterSlot": 438091799,
              "sampledBlockSlot": 438091799,
              "mintReferenceCandidates": 47,
              "retained": 32
            },
            {
              "slice": 22,
              "requestedCenterSlot": 438093269,
              "sampledBlockSlot": 438093269,
              "mintReferenceCandidates": 9,
              "retained": 9
            },
            {
              "slice": 23,
              "requestedCenterSlot": 438094739,
              "sampledBlockSlot": 438094739,
              "mintReferenceCandidates": 116,
              "retained": 32
            },
            {
              "slice": 24,
              "requestedCenterSlot": 438096210,
              "sampledBlockSlot": 438096210,
              "mintReferenceCandidates": 21,
              "retained": 21
            },
            {
              "slice": 25,
              "requestedCenterSlot": 438097680,
              "sampledBlockSlot": 438097680,
              "mintReferenceCandidates": 30,
              "retained": 30
            },
            {
              "slice": 26,
              "requestedCenterSlot": 438099150,
              "sampledBlockSlot": 438099150,
              "mintReferenceCandidates": 137,
              "retained": 32
            },
            {
              "slice": 27,
              "requestedCenterSlot": 438100620,
              "sampledBlockSlot": 438100620,
              "mintReferenceCandidates": 36,
              "retained": 32
            },
            {
              "slice": 28,
              "requestedCenterSlot": 438102090,
              "sampledBlockSlot": 438102090,
              "mintReferenceCandidates": 15,
              "retained": 15
            },
            {
              "slice": 29,
              "requestedCenterSlot": 438103560,
              "sampledBlockSlot": 438103560,
              "mintReferenceCandidates": 36,
              "retained": 32
            },
            {
              "slice": 30,
              "requestedCenterSlot": 438105030,
              "sampledBlockSlot": 438105030,
              "mintReferenceCandidates": 22,
              "retained": 22
            },
            {
              "slice": 31,
              "requestedCenterSlot": 438106501,
              "sampledBlockSlot": 438106501,
              "mintReferenceCandidates": 114,
              "retained": 32
            },
            {
              "slice": 32,
              "requestedCenterSlot": 438107971,
              "sampledBlockSlot": 438107971,
              "mintReferenceCandidates": 37,
              "retained": 32
            },
            {
              "slice": 33,
              "requestedCenterSlot": 438109441,
              "sampledBlockSlot": 438109441,
              "mintReferenceCandidates": 19,
              "retained": 19
            },
            {
              "slice": 34,
              "requestedCenterSlot": 438110911,
              "sampledBlockSlot": 438110911,
              "mintReferenceCandidates": 30,
              "retained": 30
            },
            {
              "slice": 35,
              "requestedCenterSlot": 438112381,
              "sampledBlockSlot": 438112381,
              "mintReferenceCandidates": 13,
              "retained": 13
            },
            {
              "slice": 36,
              "requestedCenterSlot": 438113851,
              "sampledBlockSlot": 438113851,
              "mintReferenceCandidates": 28,
              "retained": 28
            },
            {
              "slice": 37,
              "requestedCenterSlot": 438115321,
              "sampledBlockSlot": 438115321,
              "mintReferenceCandidates": 6,
              "retained": 6
            },
            {
              "slice": 38,
              "requestedCenterSlot": 438116792,
              "sampledBlockSlot": 438116792,
              "mintReferenceCandidates": 43,
              "retained": 32
            },
            {
              "slice": 39,
              "requestedCenterSlot": 438118262,
              "sampledBlockSlot": 438118262,
              "mintReferenceCandidates": 10,
              "retained": 10
            },
            {
              "slice": 40,
              "requestedCenterSlot": 438119732,
              "sampledBlockSlot": 438119732,
              "mintReferenceCandidates": 57,
              "retained": 32
            },
            {
              "slice": 41,
              "requestedCenterSlot": 438121202,
              "sampledBlockSlot": 438121202,
              "mintReferenceCandidates": 59,
              "retained": 32
            },
            {
              "slice": 42,
              "requestedCenterSlot": 438122672,
              "sampledBlockSlot": 438122672,
              "mintReferenceCandidates": 35,
              "retained": 32
            },
            {
              "slice": 43,
              "requestedCenterSlot": 438124142,
              "sampledBlockSlot": 438124142,
              "mintReferenceCandidates": 22,
              "retained": 22
            },
            {
              "slice": 44,
              "requestedCenterSlot": 438125612,
              "sampledBlockSlot": 438125612,
              "mintReferenceCandidates": 33,
              "retained": 32
            },
            {
              "slice": 45,
              "requestedCenterSlot": 438127083,
              "sampledBlockSlot": 438127083,
              "mintReferenceCandidates": 91,
              "retained": 32
            },
            {
              "slice": 46,
              "requestedCenterSlot": 438128553,
              "sampledBlockSlot": 438128553,
              "mintReferenceCandidates": 27,
              "retained": 27
            },
            {
              "slice": 47,
              "requestedCenterSlot": 438130023,
              "sampledBlockSlot": 438130023,
              "mintReferenceCandidates": 39,
              "retained": 32
            },
            {
              "slice": 48,
              "requestedCenterSlot": 438131493,
              "sampledBlockSlot": 438131493,
              "mintReferenceCandidates": 50,
              "retained": 32
            },
            {
              "slice": 49,
              "requestedCenterSlot": 438132963,
              "sampledBlockSlot": 438132963,
              "mintReferenceCandidates": 45,
              "retained": 32
            },
            {
              "slice": 50,
              "requestedCenterSlot": 438134433,
              "sampledBlockSlot": 438134433,
              "mintReferenceCandidates": 18,
              "retained": 18
            },
            {
              "slice": 51,
              "requestedCenterSlot": 438135904,
              "sampledBlockSlot": 438135904,
              "mintReferenceCandidates": 38,
              "retained": 32
            },
            {
              "slice": 52,
              "requestedCenterSlot": 438137374,
              "sampledBlockSlot": 438137374,
              "mintReferenceCandidates": 21,
              "retained": 21
            },
            {
              "slice": 53,
              "requestedCenterSlot": 438138844,
              "sampledBlockSlot": 438138844,
              "mintReferenceCandidates": 10,
              "retained": 10
            },
            {
              "slice": 54,
              "requestedCenterSlot": 438140314,
              "sampledBlockSlot": 438140314,
              "mintReferenceCandidates": 40,
              "retained": 32
            },
            {
              "slice": 55,
              "requestedCenterSlot": 438141784,
              "sampledBlockSlot": 438141784,
              "mintReferenceCandidates": 14,
              "retained": 14
            },
            {
              "slice": 56,
              "requestedCenterSlot": 438143254,
              "sampledBlockSlot": 438143254,
              "mintReferenceCandidates": 13,
              "retained": 13
            },
            {
              "slice": 57,
              "requestedCenterSlot": 438144724,
              "sampledBlockSlot": 438144724,
              "mintReferenceCandidates": 1,
              "retained": 1
            },
            {
              "slice": 58,
              "requestedCenterSlot": 438146195,
              "sampledBlockSlot": 438146195,
              "mintReferenceCandidates": 1,
              "retained": 1
            },
            {
              "slice": 59,
              "requestedCenterSlot": 438147665,
              "sampledBlockSlot": 438147665,
              "mintReferenceCandidates": 1,
              "retained": 1
            },
            {
              "slice": 60,
              "requestedCenterSlot": 438149135,
              "sampledBlockSlot": 438149135,
              "mintReferenceCandidates": 10,
              "retained": 10
            },
            {
              "slice": 61,
              "requestedCenterSlot": 438150605,
              "sampledBlockSlot": 438150605,
              "mintReferenceCandidates": 11,
              "retained": 11
            },
            {
              "slice": 62,
              "requestedCenterSlot": 438152075,
              "sampledBlockSlot": 438152075,
              "mintReferenceCandidates": 43,
              "retained": 32
            },
            {
              "slice": 63,
              "requestedCenterSlot": 438153545,
              "sampledBlockSlot": 438153545,
              "mintReferenceCandidates": 31,
              "retained": 31
            },
            {
              "slice": 64,
              "requestedCenterSlot": 438155015,
              "sampledBlockSlot": 438155015,
              "mintReferenceCandidates": 41,
              "retained": 32
            },
            {
              "slice": 65,
              "requestedCenterSlot": 438156486,
              "sampledBlockSlot": 438156486,
              "mintReferenceCandidates": 29,
              "retained": 29
            },
            {
              "slice": 66,
              "requestedCenterSlot": 438157956,
              "sampledBlockSlot": 438157956,
              "mintReferenceCandidates": 1,
              "retained": 1
            },
            {
              "slice": 67,
              "requestedCenterSlot": 438159426,
              "sampledBlockSlot": 438159426,
              "mintReferenceCandidates": 80,
              "retained": 32
            },
            {
              "slice": 68,
              "requestedCenterSlot": 438160896,
              "sampledBlockSlot": 438160896,
              "mintReferenceCandidates": 3,
              "retained": 3
            },
            {
              "slice": 69,
              "requestedCenterSlot": 438162366,
              "sampledBlockSlot": 438162366,
              "mintReferenceCandidates": 10,
              "retained": 10
            },
            {
              "slice": 70,
              "requestedCenterSlot": 438163836,
              "sampledBlockSlot": 438163836,
              "mintReferenceCandidates": 14,
              "retained": 14
            },
            {
              "slice": 71,
              "requestedCenterSlot": 438165306,
              "sampledBlockSlot": 438165306,
              "mintReferenceCandidates": 22,
              "retained": 22
            },
            {
              "slice": 72,
              "requestedCenterSlot": 438166777,
              "sampledBlockSlot": 438166777,
              "mintReferenceCandidates": 6,
              "retained": 6
            },
            {
              "slice": 73,
              "requestedCenterSlot": 438168247,
              "sampledBlockSlot": 438168247,
              "mintReferenceCandidates": 11,
              "retained": 11
            },
            {
              "slice": 74,
              "requestedCenterSlot": 438169717,
              "sampledBlockSlot": 438169717,
              "mintReferenceCandidates": 27,
              "retained": 27
            },
            {
              "slice": 75,
              "requestedCenterSlot": 438171187,
              "sampledBlockSlot": 438171187,
              "mintReferenceCandidates": 20,
              "retained": 20
            },
            {
              "slice": 76,
              "requestedCenterSlot": 438172657,
              "sampledBlockSlot": 438172657,
              "mintReferenceCandidates": 25,
              "retained": 25
            },
            {
              "slice": 77,
              "requestedCenterSlot": 438174127,
              "sampledBlockSlot": 438174127,
              "mintReferenceCandidates": 20,
              "retained": 20
            },
            {
              "slice": 78,
              "requestedCenterSlot": 438175597,
              "sampledBlockSlot": 438175597,
              "mintReferenceCandidates": 6,
              "retained": 6
            },
            {
              "slice": 79,
              "requestedCenterSlot": 438177068,
              "sampledBlockSlot": 438177068,
              "mintReferenceCandidates": 4,
              "retained": 4
            },
            {
              "slice": 80,
              "requestedCenterSlot": 438178538,
              "sampledBlockSlot": 438178538,
              "mintReferenceCandidates": 37,
              "retained": 32
            },
            {
              "slice": 81,
              "requestedCenterSlot": 438180008,
              "sampledBlockSlot": 438180008,
              "mintReferenceCandidates": 35,
              "retained": 32
            },
            {
              "slice": 82,
              "requestedCenterSlot": 438181478,
              "sampledBlockSlot": 438181478,
              "mintReferenceCandidates": 1,
              "retained": 1
            },
            {
              "slice": 83,
              "requestedCenterSlot": 438182948,
              "sampledBlockSlot": 438182948,
              "mintReferenceCandidates": 17,
              "retained": 17
            },
            {
              "slice": 84,
              "requestedCenterSlot": 438184418,
              "sampledBlockSlot": 438184418,
              "mintReferenceCandidates": 17,
              "retained": 17
            },
            {
              "slice": 85,
              "requestedCenterSlot": 438185889,
              "sampledBlockSlot": 438185889,
              "mintReferenceCandidates": 153,
              "retained": 32
            },
            {
              "slice": 86,
              "requestedCenterSlot": 438187359,
              "sampledBlockSlot": 438187359,
              "mintReferenceCandidates": 2,
              "retained": 2
            },
            {
              "slice": 87,
              "requestedCenterSlot": 438188829,
              "sampledBlockSlot": 438188829,
              "mintReferenceCandidates": 1,
              "retained": 1
            },
            {
              "slice": 88,
              "requestedCenterSlot": 438190299,
              "sampledBlockSlot": 438190299,
              "mintReferenceCandidates": 1,
              "retained": 1
            },
            {
              "slice": 89,
              "requestedCenterSlot": 438191769,
              "sampledBlockSlot": 438191769,
              "mintReferenceCandidates": 89,
              "retained": 32
            },
            {
              "slice": 90,
              "requestedCenterSlot": 438193239,
              "sampledBlockSlot": 438193239,
              "mintReferenceCandidates": 30,
              "retained": 30
            },
            {
              "slice": 91,
              "requestedCenterSlot": 438194709,
              "sampledBlockSlot": 438194709,
              "mintReferenceCandidates": 118,
              "retained": 32
            },
            {
              "slice": 92,
              "requestedCenterSlot": 438196180,
              "sampledBlockSlot": 438196180,
              "mintReferenceCandidates": 6,
              "retained": 6
            },
            {
              "slice": 93,
              "requestedCenterSlot": 438197650,
              "sampledBlockSlot": 438197650,
              "mintReferenceCandidates": 6,
              "retained": 6
            },
            {
              "slice": 94,
              "requestedCenterSlot": 438199120,
              "sampledBlockSlot": 438199120,
              "mintReferenceCandidates": 8,
              "retained": 8
            },
            {
              "slice": 95,
              "requestedCenterSlot": 438200590,
              "sampledBlockSlot": 438200590,
              "mintReferenceCandidates": 16,
              "retained": 16
            },
            {
              "slice": 96,
              "requestedCenterSlot": 438202060,
              "sampledBlockSlot": 438202060,
              "mintReferenceCandidates": 14,
              "retained": 14
            },
            {
              "slice": 97,
              "requestedCenterSlot": 438203530,
              "sampledBlockSlot": 438203530,
              "mintReferenceCandidates": 79,
              "retained": 32
            },
            {
              "slice": 98,
              "requestedCenterSlot": 438205000,
              "sampledBlockSlot": 438205000,
              "mintReferenceCandidates": 12,
              "retained": 12
            },
            {
              "slice": 99,
              "requestedCenterSlot": 438206471,
              "sampledBlockSlot": 438206471,
              "mintReferenceCandidates": 8,
              "retained": 8
            },
            {
              "slice": 100,
              "requestedCenterSlot": 438207941,
              "sampledBlockSlot": 438207941,
              "mintReferenceCandidates": 22,
              "retained": 22
            },
            {
              "slice": 101,
              "requestedCenterSlot": 438209411,
              "sampledBlockSlot": 438209411,
              "mintReferenceCandidates": 6,
              "retained": 6
            },
            {
              "slice": 102,
              "requestedCenterSlot": 438210881,
              "sampledBlockSlot": 438210881,
              "mintReferenceCandidates": 40,
              "retained": 32
            },
            {
              "slice": 103,
              "requestedCenterSlot": 438212351,
              "sampledBlockSlot": 438212351,
              "mintReferenceCandidates": 17,
              "retained": 17
            },
            {
              "slice": 104,
              "requestedCenterSlot": 438213821,
              "sampledBlockSlot": 438213821,
              "mintReferenceCandidates": 35,
              "retained": 32
            },
            {
              "slice": 105,
              "requestedCenterSlot": 438215291,
              "sampledBlockSlot": 438215291,
              "mintReferenceCandidates": 7,
              "retained": 7
            },
            {
              "slice": 106,
              "requestedCenterSlot": 438216762,
              "sampledBlockSlot": 438216762,
              "mintReferenceCandidates": 3,
              "retained": 3
            },
            {
              "slice": 107,
              "requestedCenterSlot": 438218232,
              "sampledBlockSlot": 438218232,
              "mintReferenceCandidates": 47,
              "retained": 32
            },
            {
              "slice": 108,
              "requestedCenterSlot": 438219702,
              "sampledBlockSlot": 438219702,
              "mintReferenceCandidates": 7,
              "retained": 7
            },
            {
              "slice": 109,
              "requestedCenterSlot": 438221172,
              "sampledBlockSlot": 438221172,
              "mintReferenceCandidates": 103,
              "retained": 32
            },
            {
              "slice": 110,
              "requestedCenterSlot": 438222642,
              "sampledBlockSlot": 438222642,
              "mintReferenceCandidates": 50,
              "retained": 32
            },
            {
              "slice": 111,
              "requestedCenterSlot": 438224112,
              "sampledBlockSlot": 438224112,
              "mintReferenceCandidates": 0,
              "retained": 0
            },
            {
              "slice": 112,
              "requestedCenterSlot": 438225583,
              "sampledBlockSlot": 438225583,
              "mintReferenceCandidates": 10,
              "retained": 10
            },
            {
              "slice": 113,
              "requestedCenterSlot": 438227053,
              "sampledBlockSlot": 438227053,
              "mintReferenceCandidates": 34,
              "retained": 32
            },
            {
              "slice": 114,
              "requestedCenterSlot": 438228523,
              "sampledBlockSlot": 438228523,
              "mintReferenceCandidates": 11,
              "retained": 11
            },
            {
              "slice": 115,
              "requestedCenterSlot": 438229993,
              "sampledBlockSlot": 438229993,
              "mintReferenceCandidates": 12,
              "retained": 12
            },
            {
              "slice": 116,
              "requestedCenterSlot": 438231463,
              "sampledBlockSlot": 438231463,
              "mintReferenceCandidates": 49,
              "retained": 32
            },
            {
              "slice": 117,
              "requestedCenterSlot": 438232933,
              "sampledBlockSlot": 438232933,
              "mintReferenceCandidates": 17,
              "retained": 17
            },
            {
              "slice": 118,
              "requestedCenterSlot": 438234403,
              "sampledBlockSlot": 438234403,
              "mintReferenceCandidates": 4,
              "retained": 4
            },
            {
              "slice": 119,
              "requestedCenterSlot": 438235874,
              "sampledBlockSlot": 438235874,
              "mintReferenceCandidates": 40,
              "retained": 32
            },
            {
              "slice": 120,
              "requestedCenterSlot": 438237344,
              "sampledBlockSlot": 438237344,
              "mintReferenceCandidates": 1,
              "retained": 1
            },
            {
              "slice": 121,
              "requestedCenterSlot": 438238814,
              "sampledBlockSlot": 438238814,
              "mintReferenceCandidates": 17,
              "retained": 17
            },
            {
              "slice": 122,
              "requestedCenterSlot": 438240284,
              "sampledBlockSlot": 438240284,
              "mintReferenceCandidates": 9,
              "retained": 9
            },
            {
              "slice": 123,
              "requestedCenterSlot": 438241754,
              "sampledBlockSlot": 438241754,
              "mintReferenceCandidates": 14,
              "retained": 14
            },
            {
              "slice": 124,
              "requestedCenterSlot": 438243224,
              "sampledBlockSlot": 438243224,
              "mintReferenceCandidates": 114,
              "retained": 32
            },
            {
              "slice": 125,
              "requestedCenterSlot": 438244694,
              "sampledBlockSlot": 438244694,
              "mintReferenceCandidates": 19,
              "retained": 19
            },
            {
              "slice": 126,
              "requestedCenterSlot": 438246165,
              "sampledBlockSlot": 438246165,
              "mintReferenceCandidates": 0,
              "retained": 0
            },
            {
              "slice": 127,
              "requestedCenterSlot": 438247635,
              "sampledBlockSlot": 438247635,
              "mintReferenceCandidates": 12,
              "retained": 12
            },
            {
              "slice": 128,
              "requestedCenterSlot": 438249105,
              "sampledBlockSlot": 438249105,
              "mintReferenceCandidates": 16,
              "retained": 16
            },
            {
              "slice": 129,
              "requestedCenterSlot": 438250575,
              "sampledBlockSlot": 438250575,
              "mintReferenceCandidates": 9,
              "retained": 9
            },
            {
              "slice": 130,
              "requestedCenterSlot": 438252045,
              "sampledBlockSlot": 438252045,
              "mintReferenceCandidates": 5,
              "retained": 5
            },
            {
              "slice": 131,
              "requestedCenterSlot": 438253515,
              "sampledBlockSlot": 438253515,
              "mintReferenceCandidates": 3,
              "retained": 3
            },
            {
              "slice": 132,
              "requestedCenterSlot": 438254985,
              "sampledBlockSlot": 438254985,
              "mintReferenceCandidates": 11,
              "retained": 11
            },
            {
              "slice": 133,
              "requestedCenterSlot": 438256456,
              "sampledBlockSlot": 438256456,
              "mintReferenceCandidates": 0,
              "retained": 0
            },
            {
              "slice": 134,
              "requestedCenterSlot": 438257926,
              "sampledBlockSlot": 438257926,
              "mintReferenceCandidates": 5,
              "retained": 5
            },
            {
              "slice": 135,
              "requestedCenterSlot": 438259396,
              "sampledBlockSlot": 438259396,
              "mintReferenceCandidates": 10,
              "retained": 10
            },
            {
              "slice": 136,
              "requestedCenterSlot": 438260866,
              "sampledBlockSlot": 438260866,
              "mintReferenceCandidates": 20,
              "retained": 20
            },
            {
              "slice": 137,
              "requestedCenterSlot": 438262336,
              "sampledBlockSlot": 438262336,
              "mintReferenceCandidates": 30,
              "retained": 30
            },
            {
              "slice": 138,
              "requestedCenterSlot": 438263806,
              "sampledBlockSlot": 438263806,
              "mintReferenceCandidates": 21,
              "retained": 21
            },
            {
              "slice": 139,
              "requestedCenterSlot": 438265276,
              "sampledBlockSlot": 438265276,
              "mintReferenceCandidates": 6,
              "retained": 6
            },
            {
              "slice": 140,
              "requestedCenterSlot": 438266747,
              "sampledBlockSlot": 438266747,
              "mintReferenceCandidates": 2,
              "retained": 2
            },
            {
              "slice": 141,
              "requestedCenterSlot": 438268217,
              "sampledBlockSlot": 438268217,
              "mintReferenceCandidates": 44,
              "retained": 32
            },
            {
              "slice": 142,
              "requestedCenterSlot": 438269687,
              "sampledBlockSlot": 438269687,
              "mintReferenceCandidates": 28,
              "retained": 28
            },
            {
              "slice": 143,
              "requestedCenterSlot": 438271157,
              "sampledBlockSlot": 438271157,
              "mintReferenceCandidates": 18,
              "retained": 18
            },
            {
              "slice": 144,
              "requestedCenterSlot": 438272627,
              "sampledBlockSlot": 438272627,
              "mintReferenceCandidates": 33,
              "retained": 32
            },
            {
              "slice": 145,
              "requestedCenterSlot": 438274097,
              "sampledBlockSlot": 438274097,
              "mintReferenceCandidates": 1,
              "retained": 1
            },
            {
              "slice": 146,
              "requestedCenterSlot": 438275568,
              "sampledBlockSlot": 438275568,
              "mintReferenceCandidates": 68,
              "retained": 32
            },
            {
              "slice": 147,
              "requestedCenterSlot": 438277038,
              "sampledBlockSlot": 438277038,
              "mintReferenceCandidates": 4,
              "retained": 4
            },
            {
              "slice": 148,
              "requestedCenterSlot": 438278508,
              "sampledBlockSlot": 438278508,
              "mintReferenceCandidates": 33,
              "retained": 32
            },
            {
              "slice": 149,
              "requestedCenterSlot": 438279978,
              "sampledBlockSlot": 438279978,
              "mintReferenceCandidates": 17,
              "retained": 17
            },
            {
              "slice": 150,
              "requestedCenterSlot": 438281448,
              "sampledBlockSlot": 438281448,
              "mintReferenceCandidates": 82,
              "retained": 32
            },
            {
              "slice": 151,
              "requestedCenterSlot": 438282918,
              "sampledBlockSlot": 438282918,
              "mintReferenceCandidates": 6,
              "retained": 6
            },
            {
              "slice": 152,
              "requestedCenterSlot": 438284388,
              "sampledBlockSlot": 438284388,
              "mintReferenceCandidates": 17,
              "retained": 17
            },
            {
              "slice": 153,
              "requestedCenterSlot": 438285859,
              "sampledBlockSlot": 438285859,
              "mintReferenceCandidates": 12,
              "retained": 12
            },
            {
              "slice": 154,
              "requestedCenterSlot": 438287329,
              "sampledBlockSlot": 438287329,
              "mintReferenceCandidates": 47,
              "retained": 32
            },
            {
              "slice": 155,
              "requestedCenterSlot": 438288799,
              "sampledBlockSlot": 438288799,
              "mintReferenceCandidates": 8,
              "retained": 8
            },
            {
              "slice": 156,
              "requestedCenterSlot": 438290269,
              "sampledBlockSlot": 438290269,
              "mintReferenceCandidates": 25,
              "retained": 25
            },
            {
              "slice": 157,
              "requestedCenterSlot": 438291739,
              "sampledBlockSlot": 438291739,
              "mintReferenceCandidates": 304,
              "retained": 32
            },
            {
              "slice": 158,
              "requestedCenterSlot": 438293209,
              "sampledBlockSlot": 438293209,
              "mintReferenceCandidates": 61,
              "retained": 32
            },
            {
              "slice": 159,
              "requestedCenterSlot": 438294679,
              "sampledBlockSlot": 438294679,
              "mintReferenceCandidates": 36,
              "retained": 32
            },
            {
              "slice": 160,
              "requestedCenterSlot": 438296150,
              "sampledBlockSlot": 438296150,
              "mintReferenceCandidates": 155,
              "retained": 32
            },
            {
              "slice": 161,
              "requestedCenterSlot": 438297620,
              "sampledBlockSlot": 438297620,
              "mintReferenceCandidates": 74,
              "retained": 32
            },
            {
              "slice": 162,
              "requestedCenterSlot": 438299090,
              "sampledBlockSlot": 438299090,
              "mintReferenceCandidates": 63,
              "retained": 32
            },
            {
              "slice": 163,
              "requestedCenterSlot": 438300560,
              "sampledBlockSlot": 438300560,
              "mintReferenceCandidates": 15,
              "retained": 15
            },
            {
              "slice": 164,
              "requestedCenterSlot": 438302030,
              "sampledBlockSlot": 438302030,
              "mintReferenceCandidates": 4,
              "retained": 4
            },
            {
              "slice": 165,
              "requestedCenterSlot": 438303500,
              "sampledBlockSlot": 438303500,
              "mintReferenceCandidates": 24,
              "retained": 24
            },
            {
              "slice": 166,
              "requestedCenterSlot": 438304970,
              "sampledBlockSlot": 438304970,
              "mintReferenceCandidates": 71,
              "retained": 32
            },
            {
              "slice": 167,
              "requestedCenterSlot": 438306441,
              "sampledBlockSlot": 438306441,
              "mintReferenceCandidates": 2,
              "retained": 2
            },
            {
              "slice": 168,
              "requestedCenterSlot": 438307911,
              "sampledBlockSlot": 438307911,
              "mintReferenceCandidates": 56,
              "retained": 32
            },
            {
              "slice": 169,
              "requestedCenterSlot": 438309381,
              "sampledBlockSlot": 438309381,
              "mintReferenceCandidates": 35,
              "retained": 32
            },
            {
              "slice": 170,
              "requestedCenterSlot": 438310851,
              "sampledBlockSlot": 438310851,
              "mintReferenceCandidates": 8,
              "retained": 8
            },
            {
              "slice": 171,
              "requestedCenterSlot": 438312321,
              "sampledBlockSlot": 438312321,
              "mintReferenceCandidates": 27,
              "retained": 27
            },
            {
              "slice": 172,
              "requestedCenterSlot": 438313791,
              "sampledBlockSlot": 438313791,
              "mintReferenceCandidates": 17,
              "retained": 17
            },
            {
              "slice": 173,
              "requestedCenterSlot": 438315262,
              "sampledBlockSlot": 438315262,
              "mintReferenceCandidates": 27,
              "retained": 27
            },
            {
              "slice": 174,
              "requestedCenterSlot": 438316732,
              "sampledBlockSlot": 438316732,
              "mintReferenceCandidates": 3,
              "retained": 3
            },
            {
              "slice": 175,
              "requestedCenterSlot": 438318202,
              "sampledBlockSlot": 438318202,
              "mintReferenceCandidates": 10,
              "retained": 10
            },
            {
              "slice": 176,
              "requestedCenterSlot": 438319672,
              "sampledBlockSlot": 438319672,
              "mintReferenceCandidates": 10,
              "retained": 10
            },
            {
              "slice": 177,
              "requestedCenterSlot": 438321142,
              "sampledBlockSlot": 438321142,
              "mintReferenceCandidates": 19,
              "retained": 19
            },
            {
              "slice": 178,
              "requestedCenterSlot": 438322612,
              "sampledBlockSlot": 438322612,
              "mintReferenceCandidates": 137,
              "retained": 32
            },
            {
              "slice": 179,
              "requestedCenterSlot": 438324082,
              "sampledBlockSlot": 438324082,
              "mintReferenceCandidates": 61,
              "retained": 32
            },
            {
              "slice": 180,
              "requestedCenterSlot": 438325553,
              "sampledBlockSlot": 438325553,
              "mintReferenceCandidates": 14,
              "retained": 14
            },
            {
              "slice": 181,
              "requestedCenterSlot": 438327023,
              "sampledBlockSlot": 438327023,
              "mintReferenceCandidates": 97,
              "retained": 32
            },
            {
              "slice": 182,
              "requestedCenterSlot": 438328493,
              "sampledBlockSlot": 438328493,
              "mintReferenceCandidates": 6,
              "retained": 6
            },
            {
              "slice": 183,
              "requestedCenterSlot": 438329963,
              "sampledBlockSlot": 438329963,
              "mintReferenceCandidates": 3,
              "retained": 3
            },
            {
              "slice": 184,
              "requestedCenterSlot": 438331433,
              "sampledBlockSlot": 438331433,
              "mintReferenceCandidates": 95,
              "retained": 32
            },
            {
              "slice": 185,
              "requestedCenterSlot": 438332903,
              "sampledBlockSlot": 438332903,
              "mintReferenceCandidates": 1,
              "retained": 1
            },
            {
              "slice": 186,
              "requestedCenterSlot": 438334373,
              "sampledBlockSlot": 438334373,
              "mintReferenceCandidates": 15,
              "retained": 15
            },
            {
              "slice": 187,
              "requestedCenterSlot": 438335844,
              "sampledBlockSlot": 438335844,
              "mintReferenceCandidates": 9,
              "retained": 9
            },
            {
              "slice": 188,
              "requestedCenterSlot": 438337314,
              "sampledBlockSlot": 438337314,
              "mintReferenceCandidates": 52,
              "retained": 32
            },
            {
              "slice": 189,
              "requestedCenterSlot": 438338784,
              "sampledBlockSlot": 438338784,
              "mintReferenceCandidates": 19,
              "retained": 19
            },
            {
              "slice": 190,
              "requestedCenterSlot": 438340254,
              "sampledBlockSlot": 438340254,
              "mintReferenceCandidates": 1,
              "retained": 1
            },
            {
              "slice": 191,
              "requestedCenterSlot": 438341724,
              "sampledBlockSlot": 438341724,
              "mintReferenceCandidates": 0,
              "retained": 0
            },
            {
              "slice": 192,
              "requestedCenterSlot": 438343194,
              "sampledBlockSlot": 438343194,
              "mintReferenceCandidates": 11,
              "retained": 11
            },
            {
              "slice": 193,
              "requestedCenterSlot": 438344664,
              "sampledBlockSlot": 438344664,
              "mintReferenceCandidates": 11,
              "retained": 11
            },
            {
              "slice": 194,
              "requestedCenterSlot": 438346135,
              "sampledBlockSlot": 438346135,
              "mintReferenceCandidates": 32,
              "retained": 32
            },
            {
              "slice": 195,
              "requestedCenterSlot": 438347605,
              "sampledBlockSlot": 438347605,
              "mintReferenceCandidates": 40,
              "retained": 32
            },
            {
              "slice": 196,
              "requestedCenterSlot": 438349075,
              "sampledBlockSlot": 438349075,
              "mintReferenceCandidates": 66,
              "retained": 32
            },
            {
              "slice": 197,
              "requestedCenterSlot": 438350545,
              "sampledBlockSlot": 438350545,
              "mintReferenceCandidates": 13,
              "retained": 13
            },
            {
              "slice": 198,
              "requestedCenterSlot": 438352015,
              "sampledBlockSlot": 438352015,
              "mintReferenceCandidates": 2,
              "retained": 2
            },
            {
              "slice": 199,
              "requestedCenterSlot": 438353485,
              "sampledBlockSlot": 438353485,
              "mintReferenceCandidates": 3,
              "retained": 3
            },
            {
              "slice": 200,
              "requestedCenterSlot": 438354955,
              "sampledBlockSlot": 438354955,
              "mintReferenceCandidates": 16,
              "retained": 16
            },
            {
              "slice": 201,
              "requestedCenterSlot": 438356426,
              "sampledBlockSlot": 438356426,
              "mintReferenceCandidates": 18,
              "retained": 18
            },
            {
              "slice": 202,
              "requestedCenterSlot": 438357896,
              "sampledBlockSlot": 438357896,
              "mintReferenceCandidates": 0,
              "retained": 0
            },
            {
              "slice": 203,
              "requestedCenterSlot": 438359366,
              "sampledBlockSlot": 438359366,
              "mintReferenceCandidates": 0,
              "retained": 0
            },
            {
              "slice": 204,
              "requestedCenterSlot": 438360836,
              "sampledBlockSlot": 438360836,
              "mintReferenceCandidates": 0,
              "retained": 0
            },
            {
              "slice": 205,
              "requestedCenterSlot": 438362306,
              "sampledBlockSlot": 438362306,
              "mintReferenceCandidates": 3,
              "retained": 3
            },
            {
              "slice": 206,
              "requestedCenterSlot": 438363776,
              "sampledBlockSlot": 438363776,
              "mintReferenceCandidates": 7,
              "retained": 7
            },
            {
              "slice": 207,
              "requestedCenterSlot": 438365247,
              "sampledBlockSlot": 438365247,
              "mintReferenceCandidates": 8,
              "retained": 8
            },
            {
              "slice": 208,
              "requestedCenterSlot": 438366717,
              "sampledBlockSlot": 438366717,
              "mintReferenceCandidates": 14,
              "retained": 14
            },
            {
              "slice": 209,
              "requestedCenterSlot": 438368187,
              "sampledBlockSlot": 438368187,
              "mintReferenceCandidates": 21,
              "retained": 21
            },
            {
              "slice": 210,
              "requestedCenterSlot": 438369657,
              "sampledBlockSlot": 438369657,
              "mintReferenceCandidates": 3,
              "retained": 3
            },
            {
              "slice": 211,
              "requestedCenterSlot": 438371127,
              "sampledBlockSlot": 438371127,
              "mintReferenceCandidates": 104,
              "retained": 32
            },
            {
              "slice": 212,
              "requestedCenterSlot": 438372597,
              "sampledBlockSlot": 438372597,
              "mintReferenceCandidates": 12,
              "retained": 12
            },
            {
              "slice": 213,
              "requestedCenterSlot": 438374067,
              "sampledBlockSlot": 438374067,
              "mintReferenceCandidates": 32,
              "retained": 32
            },
            {
              "slice": 214,
              "requestedCenterSlot": 438375538,
              "sampledBlockSlot": 438375538,
              "mintReferenceCandidates": 19,
              "retained": 19
            },
            {
              "slice": 215,
              "requestedCenterSlot": 438377008,
              "sampledBlockSlot": 438377008,
              "mintReferenceCandidates": 23,
              "retained": 23
            },
            {
              "slice": 216,
              "requestedCenterSlot": 438378478,
              "sampledBlockSlot": 438378478,
              "mintReferenceCandidates": 2,
              "retained": 2
            },
            {
              "slice": 217,
              "requestedCenterSlot": 438379948,
              "sampledBlockSlot": 438379948,
              "mintReferenceCandidates": 6,
              "retained": 6
            },
            {
              "slice": 218,
              "requestedCenterSlot": 438381418,
              "sampledBlockSlot": 438381418,
              "mintReferenceCandidates": 22,
              "retained": 22
            },
            {
              "slice": 219,
              "requestedCenterSlot": 438382888,
              "sampledBlockSlot": 438382888,
              "mintReferenceCandidates": 1,
              "retained": 1
            },
            {
              "slice": 220,
              "requestedCenterSlot": 438384358,
              "sampledBlockSlot": 438384358,
              "mintReferenceCandidates": 0,
              "retained": 0
            },
            {
              "slice": 221,
              "requestedCenterSlot": 438385829,
              "sampledBlockSlot": 438385829,
              "mintReferenceCandidates": 0,
              "retained": 0
            },
            {
              "slice": 222,
              "requestedCenterSlot": 438387299,
              "sampledBlockSlot": 438387299,
              "mintReferenceCandidates": 0,
              "retained": 0
            },
            {
              "slice": 223,
              "requestedCenterSlot": 438388769,
              "sampledBlockSlot": 438388769,
              "mintReferenceCandidates": 2,
              "retained": 2
            },
            {
              "slice": 224,
              "requestedCenterSlot": 438390239,
              "sampledBlockSlot": 438390239,
              "mintReferenceCandidates": 0,
              "retained": 0
            },
            {
              "slice": 225,
              "requestedCenterSlot": 438391709,
              "sampledBlockSlot": 438391709,
              "mintReferenceCandidates": 6,
              "retained": 6
            },
            {
              "slice": 226,
              "requestedCenterSlot": 438393179,
              "sampledBlockSlot": 438393179,
              "mintReferenceCandidates": 2,
              "retained": 2
            },
            {
              "slice": 227,
              "requestedCenterSlot": 438394649,
              "sampledBlockSlot": 438394649,
              "mintReferenceCandidates": 1,
              "retained": 1
            },
            {
              "slice": 228,
              "requestedCenterSlot": 438396120,
              "sampledBlockSlot": 438396120,
              "mintReferenceCandidates": 5,
              "retained": 5
            },
            {
              "slice": 229,
              "requestedCenterSlot": 438397590,
              "sampledBlockSlot": 438397590,
              "mintReferenceCandidates": 32,
              "retained": 32
            },
            {
              "slice": 230,
              "requestedCenterSlot": 438399060,
              "sampledBlockSlot": 438399060,
              "mintReferenceCandidates": 6,
              "retained": 6
            },
            {
              "slice": 231,
              "requestedCenterSlot": 438400530,
              "sampledBlockSlot": 438400530,
              "mintReferenceCandidates": 12,
              "retained": 12
            },
            {
              "slice": 232,
              "requestedCenterSlot": 438402000,
              "sampledBlockSlot": 438402000,
              "mintReferenceCandidates": 12,
              "retained": 12
            },
            {
              "slice": 233,
              "requestedCenterSlot": 438403470,
              "sampledBlockSlot": 438403470,
              "mintReferenceCandidates": 10,
              "retained": 10
            },
            {
              "slice": 234,
              "requestedCenterSlot": 438404940,
              "sampledBlockSlot": 438404940,
              "mintReferenceCandidates": 8,
              "retained": 8
            },
            {
              "slice": 235,
              "requestedCenterSlot": 438406411,
              "sampledBlockSlot": 438406411,
              "mintReferenceCandidates": 94,
              "retained": 32
            },
            {
              "slice": 236,
              "requestedCenterSlot": 438407881,
              "sampledBlockSlot": 438407881,
              "mintReferenceCandidates": 44,
              "retained": 32
            },
            {
              "slice": 237,
              "requestedCenterSlot": 438409351,
              "sampledBlockSlot": 438409351,
              "mintReferenceCandidates": 11,
              "retained": 11
            },
            {
              "slice": 238,
              "requestedCenterSlot": 438410821,
              "sampledBlockSlot": 438410821,
              "mintReferenceCandidates": 7,
              "retained": 7
            },
            {
              "slice": 239,
              "requestedCenterSlot": 438412291,
              "sampledBlockSlot": 438412291,
              "mintReferenceCandidates": 2,
              "retained": 2
            },
            {
              "slice": 240,
              "requestedCenterSlot": 438413761,
              "sampledBlockSlot": 438413761,
              "mintReferenceCandidates": 53,
              "retained": 32
            },
            {
              "slice": 241,
              "requestedCenterSlot": 438415232,
              "sampledBlockSlot": 438415232,
              "mintReferenceCandidates": 0,
              "retained": 0
            },
            {
              "slice": 242,
              "requestedCenterSlot": 438416702,
              "sampledBlockSlot": 438416702,
              "mintReferenceCandidates": 0,
              "retained": 0
            },
            {
              "slice": 243,
              "requestedCenterSlot": 438418172,
              "sampledBlockSlot": 438418172,
              "mintReferenceCandidates": 1,
              "retained": 1
            },
            {
              "slice": 244,
              "requestedCenterSlot": 438419642,
              "sampledBlockSlot": 438419642,
              "mintReferenceCandidates": 3,
              "retained": 3
            },
            {
              "slice": 245,
              "requestedCenterSlot": 438421112,
              "sampledBlockSlot": 438421112,
              "mintReferenceCandidates": 145,
              "retained": 32
            },
            {
              "slice": 246,
              "requestedCenterSlot": 438422582,
              "sampledBlockSlot": 438422582,
              "mintReferenceCandidates": 66,
              "retained": 32
            },
            {
              "slice": 247,
              "requestedCenterSlot": 438424052,
              "sampledBlockSlot": 438424052,
              "mintReferenceCandidates": 0,
              "retained": 0
            },
            {
              "slice": 248,
              "requestedCenterSlot": 438425523,
              "sampledBlockSlot": 438425523,
              "mintReferenceCandidates": 5,
              "retained": 5
            },
            {
              "slice": 249,
              "requestedCenterSlot": 438426993,
              "sampledBlockSlot": 438426993,
              "mintReferenceCandidates": 4,
              "retained": 4
            },
            {
              "slice": 250,
              "requestedCenterSlot": 438428463,
              "sampledBlockSlot": 438428463,
              "mintReferenceCandidates": 9,
              "retained": 9
            }
          ]
        }
      ]
    }
  },
  "totals": {
    "transactions": 8770,
    "successes": 6059,
    "failures": 2711,
    "uniquePrimarySigners": 333
  },
  "slices": [
    {
      "slice": 1,
      "slotStart": 438061664,
      "slotEnd": 438080040,
      "transactions": 735,
      "successes": 447,
      "failures": 288,
      "successRate": 0.6081632653061224,
      "failureRate": 0.39183673469387753,
      "noProfit": 121,
      "opaque": 165,
      "otherDocumented": 2,
      "medianFee": 6548,
      "medianPriorityFee": 1944,
      "medianRequestedCU": 350182,
      "medianConsumedCU": 43256,
      "uniqueSigners": 85,
      "newSigners": 85,
      "returningSigners": 0,
      "successfulNewSigners": 61,
      "successfulReturningSigners": 0,
      "returningFailingSigners": 0,
      "top1Share": 0.11156462585034013,
      "top5Share": 0.32108843537414966,
      "top10Share": 0.5102040816326531,
      "hhi": 0.03767504280623803
    },
    {
      "slice": 2,
      "slotStart": 438080041,
      "slotEnd": 438098417,
      "transactions": 582,
      "successes": 417,
      "failures": 165,
      "successRate": 0.7164948453608248,
      "failureRate": 0.28350515463917525,
      "noProfit": 58,
      "opaque": 105,
      "otherDocumented": 2,
      "medianFee": 6211,
      "medianPriorityFee": 1494,
      "medianRequestedCU": 339904,
      "medianConsumedCU": 39548,
      "uniqueSigners": 63,
      "newSigners": 27,
      "returningSigners": 36,
      "successfulNewSigners": 19,
      "successfulReturningSigners": 26,
      "returningFailingSigners": 23,
      "top1Share": 0.18900343642611683,
      "top5Share": 0.39347079037800686,
      "top10Share": 0.5824742268041238,
      "hhi": 0.06035001948489035
    },
    {
      "slice": 3,
      "slotStart": 438098418,
      "slotEnd": 438116794,
      "transactions": 614,
      "successes": 384,
      "failures": 230,
      "successRate": 0.6254071661237784,
      "failureRate": 0.3745928338762215,
      "noProfit": 92,
      "opaque": 138,
      "otherDocumented": 0,
      "medianFee": 6070.5,
      "medianPriorityFee": 1235,
      "medianRequestedCU": 330262.5,
      "medianConsumedCU": 39578,
      "uniqueSigners": 68,
      "newSigners": 18,
      "returningSigners": 50,
      "successfulNewSigners": 9,
      "successfulReturningSigners": 33,
      "returningFailingSigners": 32,
      "top1Share": 0.1449511400651466,
      "top5Share": 0.3811074918566775,
      "top10Share": 0.5586319218241043,
      "hhi": 0.04968222474509008
    },
    {
      "slice": 4,
      "slotStart": 438116795,
      "slotEnd": 438135171,
      "transactions": 574,
      "successes": 386,
      "failures": 188,
      "successRate": 0.6724738675958188,
      "failureRate": 0.32752613240418116,
      "noProfit": 49,
      "opaque": 128,
      "otherDocumented": 11,
      "medianFee": 6207,
      "medianPriorityFee": 1543,
      "medianRequestedCU": 330374.5,
      "medianConsumedCU": 38154.5,
      "uniqueSigners": 59,
      "newSigners": 15,
      "returningSigners": 44,
      "successfulNewSigners": 8,
      "successfulReturningSigners": 29,
      "returningFailingSigners": 30,
      "top1Share": 0.1480836236933798,
      "top5Share": 0.4337979094076655,
      "top10Share": 0.6341463414634146,
      "hhi": 0.05673250858939645
    },
    {
      "slice": 5,
      "slotStart": 438135172,
      "slotEnd": 438153548,
      "transactions": 440,
      "successes": 311,
      "failures": 129,
      "successRate": 0.7068181818181818,
      "failureRate": 0.29318181818181815,
      "noProfit": 23,
      "opaque": 88,
      "otherDocumented": 18,
      "medianFee": 5931.5,
      "medianPriorityFee": 1050,
      "medianRequestedCU": 330622,
      "medianConsumedCU": 39167.5,
      "uniqueSigners": 47,
      "newSigners": 18,
      "returningSigners": 29,
      "successfulNewSigners": 14,
      "successfulReturningSigners": 20,
      "returningFailingSigners": 17,
      "top1Share": 0.2340909090909091,
      "top5Share": 0.5159090909090909,
      "top10Share": 0.7340909090909091,
      "hhi": 0.08865702479338851
    },
    {
      "slice": 6,
      "slotStart": 438153549,
      "slotEnd": 438171925,
      "transactions": 383,
      "successes": 265,
      "failures": 118,
      "successRate": 0.6919060052219321,
      "failureRate": 0.30809399477806787,
      "noProfit": 22,
      "opaque": 88,
      "otherDocumented": 8,
      "medianFee": 6151,
      "medianPriorityFee": 1434,
      "medianRequestedCU": 330771,
      "medianConsumedCU": 42355,
      "uniqueSigners": 53,
      "newSigners": 13,
      "returningSigners": 40,
      "successfulNewSigners": 10,
      "successfulReturningSigners": 22,
      "returningFailingSigners": 29,
      "top1Share": 0.14882506527415143,
      "top5Share": 0.44386422976501305,
      "top10Share": 0.6684073107049608,
      "hhi": 0.06029763649626087
    },
    {
      "slice": 7,
      "slotStart": 438171926,
      "slotEnd": 438190302,
      "transactions": 378,
      "successes": 285,
      "failures": 93,
      "successRate": 0.753968253968254,
      "failureRate": 0.24603174603174602,
      "noProfit": 14,
      "opaque": 74,
      "otherDocumented": 5,
      "medianFee": 5839,
      "medianPriorityFee": 1249,
      "medianRequestedCU": 330767,
      "medianConsumedCU": 36531,
      "uniqueSigners": 39,
      "newSigners": 9,
      "returningSigners": 30,
      "successfulNewSigners": 8,
      "successfulReturningSigners": 19,
      "returningFailingSigners": 19,
      "top1Share": 0.25925925925925924,
      "top5Share": 0.5,
      "top10Share": 0.7142857142857143,
      "hhi": 0.09641387419165194
    },
    {
      "slice": 8,
      "slotStart": 438190303,
      "slotEnd": 438208679,
      "transactions": 426,
      "successes": 285,
      "failures": 141,
      "successRate": 0.6690140845070423,
      "failureRate": 0.33098591549295775,
      "noProfit": 41,
      "opaque": 87,
      "otherDocumented": 13,
      "medianFee": 5739,
      "medianPriorityFee": 1061,
      "medianRequestedCU": 330856.5,
      "medianConsumedCU": 39930,
      "uniqueSigners": 64,
      "newSigners": 17,
      "returningSigners": 47,
      "successfulNewSigners": 14,
      "successfulReturningSigners": 29,
      "returningFailingSigners": 31,
      "top1Share": 0.23943661971830985,
      "top5Share": 0.49295774647887325,
      "top10Share": 0.6502347417840375,
      "hhi": 0.08333884370385056
    },
    {
      "slice": 9,
      "slotStart": 438208680,
      "slotEnd": 438227056,
      "transactions": 500,
      "successes": 336,
      "failures": 164,
      "successRate": 0.672,
      "failureRate": 0.328,
      "noProfit": 30,
      "opaque": 129,
      "otherDocumented": 5,
      "medianFee": 6360,
      "medianPriorityFee": 1450,
      "medianRequestedCU": 330536,
      "medianConsumedCU": 42657.5,
      "uniqueSigners": 74,
      "newSigners": 21,
      "returningSigners": 53,
      "successfulNewSigners": 15,
      "successfulReturningSigners": 31,
      "returningFailingSigners": 34,
      "top1Share": 0.186,
      "top5Share": 0.502,
      "top10Share": 0.7,
      "hhi": 0.07076000000000017
    },
    {
      "slice": 10,
      "slotStart": 438227057,
      "slotEnd": 438245433,
      "transactions": 395,
      "successes": 274,
      "failures": 121,
      "successRate": 0.6936708860759494,
      "failureRate": 0.30632911392405066,
      "noProfit": 27,
      "opaque": 91,
      "otherDocumented": 3,
      "medianFee": 6554,
      "medianPriorityFee": 1747.5,
      "medianRequestedCU": 320000,
      "medianConsumedCU": 35898,
      "uniqueSigners": 46,
      "newSigners": 12,
      "returningSigners": 34,
      "successfulNewSigners": 10,
      "successfulReturningSigners": 20,
      "returningFailingSigners": 23,
      "top1Share": 0.17721518987341772,
      "top5Share": 0.5569620253164557,
      "top10Share": 0.7822784810126582,
      "hhi": 0.08535170645729867
    },
    {
      "slice": 11,
      "slotStart": 438245434,
      "slotEnd": 438263810,
      "transactions": 313,
      "successes": 235,
      "failures": 78,
      "successRate": 0.7507987220447284,
      "failureRate": 0.24920127795527156,
      "noProfit": 12,
      "opaque": 66,
      "otherDocumented": 0,
      "medianFee": 6781,
      "medianPriorityFee": 1982,
      "medianRequestedCU": 299500,
      "medianConsumedCU": 34387,
      "uniqueSigners": 41,
      "newSigners": 8,
      "returningSigners": 33,
      "successfulNewSigners": 5,
      "successfulReturningSigners": 21,
      "returningFailingSigners": 20,
      "top1Share": 0.15654952076677317,
      "top5Share": 0.5399361022364217,
      "top10Share": 0.7539936102236422,
      "hhi": 0.07911686349763711
    },
    {
      "slice": 12,
      "slotStart": 438263811,
      "slotEnd": 438282187,
      "transactions": 471,
      "successes": 333,
      "failures": 138,
      "successRate": 0.7070063694267515,
      "failureRate": 0.2929936305732484,
      "noProfit": 28,
      "opaque": 105,
      "otherDocumented": 5,
      "medianFee": 5904,
      "medianPriorityFee": 1365.5,
      "medianRequestedCU": 330797,
      "medianConsumedCU": 35990,
      "uniqueSigners": 57,
      "newSigners": 10,
      "returningSigners": 47,
      "successfulNewSigners": 7,
      "successfulReturningSigners": 29,
      "returningFailingSigners": 31,
      "top1Share": 0.11677282377919321,
      "top5Share": 0.4182590233545648,
      "top10Share": 0.6518046709129511,
      "hhi": 0.05312363359342953
    },
    {
      "slice": 13,
      "slotStart": 438282188,
      "slotEnd": 438300564,
      "transactions": 570,
      "successes": 384,
      "failures": 186,
      "successRate": 0.6736842105263158,
      "failureRate": 0.3263157894736842,
      "noProfit": 65,
      "opaque": 105,
      "otherDocumented": 16,
      "medianFee": 6075.5,
      "medianPriorityFee": 1631,
      "medianRequestedCU": 359880,
      "medianConsumedCU": 41626.5,
      "uniqueSigners": 81,
      "newSigners": 18,
      "returningSigners": 63,
      "successfulNewSigners": 12,
      "successfulReturningSigners": 41,
      "returningFailingSigners": 45,
      "top1Share": 0.13333333333333333,
      "top5Share": 0.38596491228070173,
      "top10Share": 0.5649122807017544,
      "hhi": 0.046531240381655854
    },
    {
      "slice": 14,
      "slotStart": 438300565,
      "slotEnd": 438318941,
      "transactions": 444,
      "successes": 333,
      "failures": 111,
      "successRate": 0.75,
      "failureRate": 0.25,
      "noProfit": 24,
      "opaque": 85,
      "otherDocumented": 2,
      "medianFee": 5951,
      "medianPriorityFee": 1398,
      "medianRequestedCU": 352532,
      "medianConsumedCU": 36237,
      "uniqueSigners": 46,
      "newSigners": 3,
      "returningSigners": 43,
      "successfulNewSigners": 3,
      "successfulReturningSigners": 30,
      "returningFailingSigners": 27,
      "top1Share": 0.17117117117117117,
      "top5Share": 0.4436936936936937,
      "top10Share": 0.6801801801801802,
      "hhi": 0.06440224007791569
    },
    {
      "slice": 15,
      "slotStart": 438318942,
      "slotEnd": 438337318,
      "transactions": 482,
      "successes": 348,
      "failures": 134,
      "successRate": 0.7219917012448133,
      "failureRate": 0.27800829875518673,
      "noProfit": 17,
      "opaque": 115,
      "otherDocumented": 2,
      "medianFee": 6056.5,
      "medianPriorityFee": 1525.5,
      "medianRequestedCU": 345240,
      "medianConsumedCU": 36199,
      "uniqueSigners": 46,
      "newSigners": 5,
      "returningSigners": 41,
      "successfulNewSigners": 5,
      "successfulReturningSigners": 27,
      "returningFailingSigners": 25,
      "top1Share": 0.13692946058091288,
      "top5Share": 0.42531120331950206,
      "top10Share": 0.6784232365145229,
      "hhi": 0.05927928238150172
    },
    {
      "slice": 16,
      "slotStart": 438337319,
      "slotEnd": 438355695,
      "transactions": 309,
      "successes": 212,
      "failures": 97,
      "successRate": 0.686084142394822,
      "failureRate": 0.313915857605178,
      "noProfit": 5,
      "opaque": 82,
      "otherDocumented": 10,
      "medianFee": 5428,
      "medianPriorityFee": 976.5,
      "medianRequestedCU": 359880,
      "medianConsumedCU": 43548,
      "uniqueSigners": 52,
      "newSigners": 13,
      "returningSigners": 39,
      "successfulNewSigners": 12,
      "successfulReturningSigners": 25,
      "returningFailingSigners": 23,
      "top1Share": 0.12297734627831715,
      "top5Share": 0.42071197411003236,
      "top10Share": 0.627831715210356,
      "hhi": 0.05262827159330131
    },
    {
      "slice": 17,
      "slotStart": 438355696,
      "slotEnd": 438374072,
      "transactions": 368,
      "successes": 237,
      "failures": 131,
      "successRate": 0.6440217391304348,
      "failureRate": 0.35597826086956524,
      "noProfit": 28,
      "opaque": 99,
      "otherDocumented": 4,
      "medianFee": 5872,
      "medianPriorityFee": 1387,
      "medianRequestedCU": 359880,
      "medianConsumedCU": 39739,
      "uniqueSigners": 64,
      "newSigners": 16,
      "returningSigners": 48,
      "successfulNewSigners": 14,
      "successfulReturningSigners": 31,
      "returningFailingSigners": 33,
      "top1Share": 0.10597826086956522,
      "top5Share": 0.37771739130434784,
      "top10Share": 0.6032608695652174,
      "hhi": 0.04582644139886568
    },
    {
      "slice": 18,
      "slotStart": 438374073,
      "slotEnd": 438392449,
      "transactions": 184,
      "successes": 112,
      "failures": 72,
      "successRate": 0.6086956521739131,
      "failureRate": 0.391304347826087,
      "noProfit": 35,
      "opaque": 35,
      "otherDocumented": 2,
      "medianFee": 6435.5,
      "medianPriorityFee": 1773,
      "medianRequestedCU": 380030,
      "medianConsumedCU": 39732,
      "uniqueSigners": 37,
      "newSigners": 6,
      "returningSigners": 31,
      "successfulNewSigners": 5,
      "successfulReturningSigners": 23,
      "returningFailingSigners": 20,
      "top1Share": 0.125,
      "top5Share": 0.391304347826087,
      "top10Share": 0.5978260869565217,
      "hhi": 0.05044896030245742
    },
    {
      "slice": 19,
      "slotStart": 438392450,
      "slotEnd": 438410826,
      "transactions": 357,
      "successes": 280,
      "failures": 77,
      "successRate": 0.7843137254901961,
      "failureRate": 0.21568627450980393,
      "noProfit": 19,
      "opaque": 57,
      "otherDocumented": 1,
      "medianFee": 5594,
      "medianPriorityFee": 1017.5,
      "medianRequestedCU": 359880,
      "medianConsumedCU": 36218,
      "uniqueSigners": 49,
      "newSigners": 13,
      "returningSigners": 36,
      "successfulNewSigners": 12,
      "successfulReturningSigners": 28,
      "returningFailingSigners": 20,
      "top1Share": 0.19327731092436976,
      "top5Share": 0.5434173669467787,
      "top10Share": 0.7535014005602241,
      "hhi": 0.08132664830638141
    },
    {
      "slice": 20,
      "slotStart": 438410827,
      "slotEnd": 438429195,
      "transactions": 245,
      "successes": 195,
      "failures": 50,
      "successRate": 0.7959183673469388,
      "failureRate": 0.20408163265306123,
      "noProfit": 18,
      "opaque": 30,
      "otherDocumented": 2,
      "medianFee": 6314,
      "medianPriorityFee": 1520,
      "medianRequestedCU": 330977,
      "medianConsumedCU": 39815,
      "uniqueSigners": 42,
      "newSigners": 6,
      "returningSigners": 36,
      "successfulNewSigners": 6,
      "successfulReturningSigners": 23,
      "returningFailingSigners": 22,
      "top1Share": 0.2530612244897959,
      "top5Share": 0.5591836734693878,
      "top10Share": 0.7183673469387755,
      "hhi": 0.09814244064972935
    }
  ],
  "recurrence": {
    "firstSuccess": 233,
    "firstSuccessAppearsAgain": 0.26609442060085836,
    "firstSuccessSucceedsAgain": 0.2446351931330472,
    "firstFailure": 100,
    "firstFailureAppearsAgain": 0.76,
    "firstFailureSucceedsAgain": 0.34,
    "sequence": {
      "successSuccess": 5121,
      "successFailureSuccess": 353,
      "failureSuccess": 705,
      "failureFailure": 1906
    }
  },
  "concentration": {
    "top1Share": 0.16431014823261117,
    "top5Share": 0.3621436716077537,
    "top10Share": 0.5517673888255417,
    "hhi": 0.048784092135388805,
    "successTop1Share": 0.23782802442647302,
    "successTop5Share": 0.4916652913021951
  },
  "failureClasses": [
    {
      "value": "opaque-custom-error",
      "total": 1863
    },
    {
      "value": "explicit-no-profit-or-route",
      "total": 728
    },
    {
      "value": "NoProfit",
      "total": 79
    },
    {
      "value": "BuySlippageBelowMinBaseAmountOut",
      "total": 10
    },
    {
      "value": "undocumented",
      "total": 9
    },
    {
      "value": "ExceededSlippage",
      "total": 6
    },
    {
      "value": "Overflow",
      "total": 5
    },
    {
      "value": "NotProfitable",
      "total": 4
    },
    {
      "value": "NonceAlreadyExists",
      "total": 2
    },
    {
      "value": "Unknown",
      "total": 2
    },
    {
      "value": "InsufficientLamports",
      "total": 1
    },
    {
      "value": "LessThanMinimumAmountOut",
      "total": 1
    },
    {
      "value": "BuyNotEnoughQuoteTokensToCoverFees",
      "total": 1
    }
  ],
  "noProfit": {
    "count": 728,
    "uniquePrimarySigners": 27,
    "topSigners": [
      {
        "value": "3KvsoNxgn64nsuHKPBHQJsguef3DgEkP2izE49k6CSAZ",
        "total": 163
      },
      {
        "value": "JAkGWTYLnan5ZJRuX3FRU8ffS9rNKNVVjks8BPEZzAxi",
        "total": 81
      },
      {
        "value": "Aet81p95mmuKjmMZPqDPmnupgU6RmQT3MmM4JojBEcst",
        "total": 55
      },
      {
        "value": "5onzSxXSL3fKgGVmLrsvxdzrUyWKkFFEmu29njiiZHiK",
        "total": 51
      },
      {
        "value": "628tuaH9DuYK7W36wW6s9aPpwcUcWoropaWWL3HfeS6f",
        "total": 48
      },
      {
        "value": "39KwYt6BVzB2Pm4RCERYDowPqhK8eXfAsg9B7D7V17Vd",
        "total": 44
      },
      {
        "value": "6Ta1LBdnwYkftYBTddsWqGR4JDB4NVbNrFtwB2E2mMLH",
        "total": 42
      },
      {
        "value": "327677XqTEwYxo8kaQxAJUWvUvzpVoSjiMXMc8u4wQS6",
        "total": 39
      },
      {
        "value": "GNXde6RFXe94yBTgjNJbtcZKyJ2TWfQMt8M14P2MdTe",
        "total": 36
      },
      {
        "value": "Luckywzbt7nYBhmEZLnzqAsQmRE8bMmgyduxsP5kktR",
        "total": 26
      }
    ],
    "programs": [
      {
        "value": "4Qv3mbzcq1bKmrhGG4voS3EemfPd7f838FLUU7wBHSyi",
        "total": 472
      },
      {
        "value": "Prism8hsRo6Ww5jiN5Zeh3YDPLZHqHduCPSAV7JF7qv",
        "total": 230
      },
      {
        "value": "HiPMPcYjLNPgjvdzBoavzMbCeHaXWkAuDxyuE9VoPrkf",
        "total": 26
      }
    ]
  },
  "programEcology": {
    "successful": [
      {
        "value": "ComputeBudget111111111111111111111111111111",
        "total": 6048
      },
      {
        "value": "11111111111111111111111111111111",
        "total": 1763
      },
      {
        "value": "FsU1rcaEC361jBr9JE5wm7bpWRSTYeAMN4R2MCs11rNF",
        "total": 1441
      },
      {
        "value": "6MWVTis8rmmk6Vt9zmAJJbmb3VuLpzoQ1aHH4N6wQEGh",
        "total": 913
      },
      {
        "value": "HVi6VyyLvTtFTA8f8atavxVjUKi8WjmnydfKgoZKzt7H",
        "total": 472
      },
      {
        "value": "NA247a7YE9S3p9CdKmMyETx8TTwbSdVbVYHHxpnHTUV",
        "total": 388
      },
      {
        "value": "DDsnwb7dxKSjzTYDFjU8F6rpYNZa1sp7Fmfb2nGDAMEo",
        "total": 363
      },
      {
        "value": "SoLSzZ1g1d8JpJyer4e4i1mS4sMirdjvRbwfjsaAVk4",
        "total": 337
      },
      {
        "value": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        "total": 324
      },
      {
        "value": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
        "total": 324
      },
      {
        "value": "4Qv3mbzcq1bKmrhGG4voS3EemfPd7f838FLUU7wBHSyi",
        "total": 280
      },
      {
        "value": "3QUnrcMqCQoiGB73s1A6uDzxziywaNFpTLiZiiZbEUoN",
        "total": 243
      },
      {
        "value": "3yGCLwQWdeS6jQvPgPYb7eDW1TQ9otWnuyyZFRC9K6K6",
        "total": 234
      },
      {
        "value": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
        "total": 224
      },
      {
        "value": "Prism8hsRo6Ww5jiN5Zeh3YDPLZHqHduCPSAV7JF7qv",
        "total": 207
      },
      {
        "value": "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo",
        "total": 195
      },
      {
        "value": "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA",
        "total": 193
      },
      {
        "value": "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ",
        "total": 193
      },
      {
        "value": "D9Yy9eQotf1GgJSseERiYCYH4BYxpWXkftUm9GxLzkA7",
        "total": 182
      },
      {
        "value": "2VSNUquk7FqkbS27WJpm6J1175EhoLcGtxuExu3wrzVz",
        "total": 153
      }
    ],
    "failed": [
      {
        "value": "ComputeBudget111111111111111111111111111111",
        "total": 2711
      },
      {
        "value": "11111111111111111111111111111111",
        "total": 2149
      },
      {
        "value": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
        "total": 754
      },
      {
        "value": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        "total": 673
      },
      {
        "value": "NA247a7YE9S3p9CdKmMyETx8TTwbSdVbVYHHxpnHTUV",
        "total": 653
      },
      {
        "value": "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo",
        "total": 621
      },
      {
        "value": "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA",
        "total": 595
      },
      {
        "value": "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ",
        "total": 593
      },
      {
        "value": "4Qv3mbzcq1bKmrhGG4voS3EemfPd7f838FLUU7wBHSyi",
        "total": 472
      },
      {
        "value": "CZr8VacFkAVKXYgiB5VFmZWE42Bi7XTkNmsMwN5EyzhP",
        "total": 305
      },
      {
        "value": "Prism8hsRo6Ww5jiN5Zeh3YDPLZHqHduCPSAV7JF7qv",
        "total": 230
      },
      {
        "value": "3yGCLwQWdeS6jQvPgPYb7eDW1TQ9otWnuyyZFRC9K6K6",
        "total": 182
      },
      {
        "value": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
        "total": 179
      },
      {
        "value": "6MWVTis8rmmk6Vt9zmAJJbmb3VuLpzoQ1aHH4N6wQEGh",
        "total": 168
      },
      {
        "value": "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
        "total": 101
      },
      {
        "value": "31KJbyd5umqKQ9a3NuFWuhV1MLUQkg3FBrn3vE7L9R1t",
        "total": 86
      },
      {
        "value": "Zc5CGD36BMMcoHKZwfEdu9wRnZkJMGehft4qbYqgcjN",
        "total": 76
      },
      {
        "value": "2VSNUquk7FqkbS27WJpm6J1175EhoLcGtxuExu3wrzVz",
        "total": 72
      },
      {
        "value": "DDsnwb7dxKSjzTYDFjU8F6rpYNZa1sp7Fmfb2nGDAMEo",
        "total": 60
      },
      {
        "value": "HiPMPcYjLNPgjvdzBoavzMbCeHaXWkAuDxyuE9VoPrkf",
        "total": 26
      }
    ]
  }
}
