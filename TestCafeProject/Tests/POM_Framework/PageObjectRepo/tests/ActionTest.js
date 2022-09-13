import {Selector} from 'testcafe'

//Element locators
const checkbox1 = Selector('#remote-testing');
const nameField = Selector ('#developer-name');
const windowRadioBtn = Selector ('#windows');
const hoverOption = Selector ('a').withText('BARRY STONE');
const testCafeInterface = Selector('#preferred-interface');
const testCafeInterfaceOption = Selector('option').withText('JavaScript API');


fixture (`Test Cafe Actions test`)
    .page `https://devexpress.github.io/testcafe/example`;

    test('Perform Maximize and input test', async t =>{
        await t
        .maximizeWindow()
        .typeText(nameField, 'TestCafe')
        .wait(3000)
        
    });
    test('Perform type and replace test', async t =>{
        await t
        .maximizeWindow()
        .typeText(nameField, 'TestCafe')
        .typeText(nameField, 'CafeShop', {replace:true})
        .wait(3000)
        
    });
    test('Perform click check box test', async t =>{
        await t
        .maximizeWindow()
        .click(checkbox1)
        .wait(3000)
        
    });
    test('Perform check radio button test', async t =>{
        await t
        .maximizeWindow()
        .click(windowRadioBtn)
        .wait(3000)
        
    });
    test('Perform press key test', async t =>{
        await t
        .maximizeWindow()
        .typeText(nameField, 'TestCafe')
        .pressKey('home right . delete =')
        .wait(3000)
        
    });
    test('Perform select text test', async t =>{
        await t
        .maximizeWindow()
        .typeText(nameField, 'TestCafe')
        .selectText(nameField, 6, 0)
        .wait(3000)
        
    });
    test('Perform hovering test', async t =>{
        await t
        .maximizeWindow()
        .navigateTo ('https://artpalacegallery.com/')
        .hover(hoverOption)
        .wait(3000)
        
    });
    test('Perform nativagation to other url test', async t =>{
        await t
        .maximizeWindow()
        .typeText(nameField, 'Place navigate to other url')
        .navigateTo ('https://artpalacegallery.com/')
        .wait(3000)
        
    });
    test('Perform scrennshot action test', async t =>{
        await t
        .maximizeWindow()
        .typeText(nameField, 'Take Screenshot')
        .takeScreenshot('FirstScreenShot.png')
        .wait(3000)
        
    });
    test('Perform selecting from a list test', async t =>{
        await t
        .maximizeWindow()
        .click(testCafeInterface)
        .wait(200)
        .click(testCafeInterfaceOption)
        .wait(3000)
        
    });
    test('Perform get text test', async t =>{
        await t
        .maximizeWindow()
        .click(testCafeInterface)
        .wait(200)
        .click(testCafeInterfaceOption)
        .wait(3000)

    
    });



