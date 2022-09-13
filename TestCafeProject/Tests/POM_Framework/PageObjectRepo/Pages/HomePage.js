import {Selector} from 'testcafe';


class HomePage{

    constructor(){

      this. successMessage = Selector ('div').withText('You logged into a secure area!');
      this. headerText = Selector ('h2').withText('Secure Area');
      this. subHeaderText = Selector ('h4').withText('Welcome to the Secure Area. When you are done click logout below.');
      this. logoutBtn = Selector ('.icon-2x.icon-signout');
    }

    async clickLogoutbtn(){git
      await t
      .click(this.logoutBtn)
    }


}
export default  new HomePage();