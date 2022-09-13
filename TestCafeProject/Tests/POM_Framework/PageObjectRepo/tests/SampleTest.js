import {Selector} from 'testcafe';

fixture (`Test Cafe Sample test`)
    .page `https://devexpress.github.io/testcafe/example`;

    test('My first TestCafe test', async t =>{
        await t
        .wait(3000)
        
    });
    test('My second TestCafe test', async t =>{
        await t
        .wait(3000)

    });
