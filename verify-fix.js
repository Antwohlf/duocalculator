// Verification script for unit label fix
// This simulates how the app processes units

const testScenarios = [
    {
        name: "Synthetic course (no descriptive titles)",
        units: [
            { unitIndex: 1, title: "Unit 1", activities: 10 },
            { unitIndex: 2, title: "Unit 2", activities: 10 },
            { unitIndex: 3, title: "Unit 3", activities: 10 },
        ],
        expectedLabels: [
            "Unit 1 (10 lessons)",
            "Unit 2 (10 lessons)",
            "Unit 3 (10 lessons)",
        ]
    },
    {
        name: "Real course (with descriptive titles)",
        units: [
            { unitIndex: 1, title: "Basic Greetings", activities: 8 },
            { unitIndex: 2, title: "Food and Drink", activities: 12 },
            { unitIndex: 3, title: "Travel Basics", activities: 15 },
        ],
        expectedLabels: [
            "Unit 1: Basic Greetings (8 lessons)",
            "Unit 2: Food and Drink (12 lessons)",
            "Unit 3: Travel Basics (15 lessons)",
        ]
    },
    {
        name: "Mixed (some descriptive, some generic)",
        units: [
            { unitIndex: 1, title: "Unit 1", activities: 10 },
            { unitIndex: 2, title: "Colors and Numbers", activities: 10 },
            { unitIndex: 3, title: "unit 3", activities: 10 },
        ],
        expectedLabels: [
            "Unit 1 (10 lessons)",
            "Unit 2: Colors and Numbers (10 lessons)",
            "Unit 3 (10 lessons)",
        ]
    }
];

function generateLabel(unit) {
    const status = typeof unit.activities === "number" 
        ? `${unit.activities} lessons` 
        : "lessons estimated";
    
    // This is the fix logic from app.js
    const isGenericTitle = /^Unit\s+\d+$/i.test(unit.title?.trim() || '');
    const label = isGenericTitle 
        ? `Unit ${unit.unitIndex}` 
        : `Unit ${unit.unitIndex}: ${unit.title}`;
    
    return `${label} (${status})`;
}

console.log("🧪 Testing Unit Label Fix\n");
console.log("=".repeat(60));

let allPassed = true;

testScenarios.forEach(scenario => {
    console.log(`\n📋 ${scenario.name}`);
    console.log("-".repeat(60));
    
    scenario.units.forEach((unit, index) => {
        const actual = generateLabel(unit);
        const expected = scenario.expectedLabels[index];
        const pass = actual === expected;
        
        if (!pass) allPassed = false;
        
        console.log(`  ${pass ? '✓' : '✗'} Unit ${unit.unitIndex}:`);
        console.log(`    Input title: "${unit.title}"`);
        console.log(`    Expected:    "${expected}"`);
        console.log(`    Actual:      "${actual}"`);
        
        if (!pass) {
            console.log(`    ❌ MISMATCH!`);
        }
    });
});

console.log("\n" + "=".repeat(60));
console.log(allPassed ? "✅ ALL TESTS PASSED!" : "❌ SOME TESTS FAILED!");
console.log("=".repeat(60));

process.exit(allPassed ? 0 : 1);
