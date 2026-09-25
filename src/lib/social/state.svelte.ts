// The little social state the always-loaded views need; everything else lives in lazy modules next to this one.
class SocialUi {
  roomOpen = $state(false); // Focus shows the study-room card
  classUrl = $state(''); // a class-list link opened the app: Class mode offers to subscribe to it
}

export const socialUi = new SocialUi();
