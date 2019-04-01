ko.bindingHandlers.dateTimePicker = {
  init: function (element, valueAccessor, allBindingsAccessor) {
    var options = allBindingsAccessor().dateTimePickerOptions || {};
    var initialValue = ko.utils.unwrapObservable(valueAccessor());
    if (initialValue) {
      options.date = initialValue;
    }
    $(element).datetimepicker(options);

    ko.utils.registerEventHandler(element, "change.datetimepicker", function (event) {
      var value = valueAccessor();
      if (ko.isObservable(value)) {
        value(event.date || null);
      }
    });

    ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
      $(element).datetimepicker("destroy");
    });
  },
  update: function (element, valueAccessor) {
    var val = ko.utils.unwrapObservable(valueAccessor());
    if ($(element).datetimepicker) {
      $(element).datetimepicker("date", val);
    }
  }
};