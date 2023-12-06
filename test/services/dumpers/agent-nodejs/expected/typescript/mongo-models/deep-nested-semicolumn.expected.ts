import Mongoose from 'mongoose';

interface PersonsInterface {
  very: {
    deep: {
      model: {
        arrayOfNumber: Array<number>;
        arrayMixed: Array<object>;
        arrayOfObjectIds: Array<Mongoose.Types.ObjectId>;
        arrayWithComplexObject: Array<{
          _id: Mongoose.Types.ObjectId;
          name: string;
          propGroup: {
            date: Date;
            sentence: string;
            number: number;
          };
        }>;
        arrayOfComplexObjects: Array<{
          _id: Mongoose.Types.ObjectId;
          propGroup: {
            answer: boolean;
            date: Date;
            sentence: string;
            number: number;
          };
        }>;
      };
    };
  };
}

const personsSchema = new Mongoose.Schema({
  very: {
    deep: {
      model: {
        arrayOfNumber: [Number],
        arrayMixed: [Object],
        arrayOfObjectIds: [Mongoose.Schema.Types.ObjectId],
        arrayWithComplexObject: [{
          name: String,
          propGroup: {
            date: Date,
            sentence: String,
            number: Number,
          },
        }],
        arrayOfComplexObjects: [{
          propGroup: {
            answer: Boolean,
            date: Date,
            sentence: String,
            number: Number,
          },
        }],
      },
    },
  },
}, {
  timestamps: false,
});

export { PersonsInterface, personsSchema };
