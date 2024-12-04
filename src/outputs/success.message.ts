/**
 * Represents a success message object.
 * @class
 */
export class SuccessMessage {
    /**
     * The success message.
     * @type {string}
     */
    message: string;
  
    /**
     * Creates an instance of SuccessMessage.
     * @param {string} message - The success message.
     */
    constructor(message: string) {
      this.message = message;
    }
  
    /**
     * Converts the SuccessMessage object to JSON format.
     * @returns {{ success: string }} - The success message in JSON format.
     */
    toJSON() {
      return { success: this.message };
    }
  }
  