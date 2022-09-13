import {Selector} from 'testcafe';

//element locator
const nameField = Selector ('#developer-name');

fixture `Test Cafe Sample test`
    .page `https://devexpress.github.io/testcafe/example`;

    test('Take Screenshot on test failure test', async t =>{
        await t
        .maximizeWindow()
        .typeText(nameField, 'TestCafe')
        .wait(2000)
        .expect(nameField.value).eql('TestCafed')
        
        //Run > 
        //testcafe chrome TakeScreenShotOnFailure.js -S -s Screenshot_Failed
        
    });


