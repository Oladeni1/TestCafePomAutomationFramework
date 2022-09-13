import {Selector} from 'testcafe';

//element locators
const usernameField = Selector ('#username');
const passwordField = Selector ('#password');
const loginBtn = Selector ('button').withText('Login');
const invalidUsername = 'TestCafe';
const invalidPassword = 'TestCafe';
const errorMessage = Selector ('div').withText('Your username is invalid!');
const validUsername = 'tomsmith';
const validPassword = 'SuperSecretPassword!';
const successMessage = Selector ('div').withText('You logged into a secure area!');


fixture(`Login functionality`)

    .page ('https://the-internet.herokuapp.com/login');

    test('Negative login scenario test - Invalid credentials', async t =>{
        await t
        .maximizeWindow()
        .typeText(usernameField, invalidUsername)
        .typeText(passwordField, invalidPassword)
        .click(loginBtn)
        .wait(2000)
        .expect(errorMessage.exists).ok()

    });
    test('Positive login scenario test - Valid credentials', async t =>{
        await t
        .maximizeWindow()
        .typeText(usernameField, validUsername)
        .typeText(passwordField, validPassword)
        .click(loginBtn)
        .wait(2000)
        .expect(successMessage.exists).ok()

    });